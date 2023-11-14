"use strict";
const { createHmac, randomUUID } = require("crypto");
const { sign } = require("jsonwebtoken");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/**
 * @param {string} password
 * @param {string} salt
 * @returns {string}
 */
function hash(password, salt) {
    let hash = createHmac("sha512", salt);
    hash.update(password);
    return hash.digest("hex");
}

/**
 * @param {string} username
 * @returns {Promise<{password: string, salt: string} | null>}
 */
async function getUserCreds(username) {
    try {
        const data = await dynamo.send(
            new GetCommand({
                TableName: process.env.TABLE_NAME,
                Key: {
                    username: username,
                },
                ProjectionExpression: "password, salt",
            })
        );
        const gotItems = data.Item?.password && data.Item?.salt;
        return gotItems ? data.Item : null;
    } catch (err) {
        console.error(err);
        return null;
    }
}

/**
 * @param {string} user
 * @returns {{username: string, password: string}}
 */
function parseUser(user) {
    user = JSON.parse(user);
    const username = user.username.trim();
    const password = user.password.trim();
    if (username.length === 0) {
        throw new Error("Username cannot be empty");
    }
    if (username.length > 255) {
        throw new Error("Username cannot be longer than 255 characters");
    }
    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
    }

    return {
        username: username,
        password: password,
    };
}

/**
 * @param {string} username
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
async function putSession(username, sessionId) {
    try {
        await dynamo.send(
            new UpdateCommand({
                TableName: process.env.TABLE_NAME,
                Key: {
                    username: username,
                },
                UpdateExpression: "SET sessionId = :sessionId",
                ExpressionAttributeValues: {
                    ":sessionId": sessionId,
                },
            })
        );
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

async function handler(event) {
    const body = event.body;
    let user = undefined;
    try {
        user = parseUser(body);
    } catch (err) {
        return {
            statusCode: 400,
            body: err.message,
        };
    }

    const creds = await getUserCreds(user.username);
    if (!creds) {
        return {
            statusCode: 401,
            body: "User not found",
        };
    }

    const hashedPassword = hash(user.password, creds.salt);
    if (hashedPassword !== creds.password) {
        return {
            statusCode: 401,
            body: "Incorrect password",
        };
    }

    const sessionId = randomUUID().replace(/-/g, "");
    const putSessionSuccess = await putSession(user.username, sessionId);
    if (!putSessionSuccess) {
        return {
            statusCode: 500,
            body: "Failed to create session",
        };
    }

    const jwtPayload = {
        username: user.username,
        sessionId: sessionId,
    };
    const jwtOptions = {
        algorithm: "HS512",
        expiresIn: "7d",
    };
    const loginToken = sign(jwtPayload, process.env.JWT_SECRET, jwtOptions);
    return {
        statusCode: 200,
        body: loginToken,
    };
}

module.exports = { handler };
