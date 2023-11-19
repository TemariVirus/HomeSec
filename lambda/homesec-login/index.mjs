"use strict";
import { createHmac, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

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
                TableName: process.env.USER_TABLE,
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
function parseUser(body) {
    const user = JSON.parse(body);
    const username = user.username.trim();
    const password = user.password.trim();
    // Username and password must fulfill these requirements when registering,
    // so we don't need to query the database if they fail these checks.
    if (username.length === 0 || username.length > 255) {
        throw new Error("User not found");
    }
    if (password.length < 8) {
        throw new Error("Incorrect password");
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
                TableName: process.env.USER_TABLE,
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

/**
 * @param {number} status
 * @param {string | undefined} body
 * @returns {{
 *     statusCode: number,
 *     headers: {
 *         Content-Type: string,
 *         Access-Control-Allow-Origin: string,
 *         Access-Control-Allow-Methods: string
 *     },
 *     body: string
 * }}
 */
function formatResponse(status, body) {
    return {
        statusCode: status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
        },
        body: body,
    };
}

export async function handler(event) {
    const body = event.body;
    let user = undefined;
    try {
        user = parseUser(body);
    } catch (err) {
        return formatResponse(401, err.message);
    }

    const creds = await getUserCreds(user.username);
    if (!creds) {
        return formatResponse(401, "User not found");
    }

    const hashedPassword = hash(user.password, creds.salt);
    if (hashedPassword !== creds.password) {
        return formatResponse(401, "Incorrect password");
    }

    const sessionId = randomBytes(18).toString("base64");
    const putSessionSuccess = await putSession(user.username, sessionId);
    if (!putSessionSuccess) {
        return formatResponse(500, "Failed to create session");
    }

    const jwtPayload = {
        username: user.username,
        sessionId: sessionId,
    };
    const jwtOptions = {
        algorithm: "HS512",
        expiresIn: "7d",
    };
    const loginToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, jwtOptions);
    return formatResponse(200, loginToken);
}
