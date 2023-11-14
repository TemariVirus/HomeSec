"use strict";
var crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "homesec";
const SALT_BIT_SIZE = 128;

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/**
 * @param {number} length
 * @returns {string}
 */
function generateSalt(length) {
    return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
}

/**
 * @param {string} password
 * @param {string} salt
 * @returns {string}
 */
function hash(password, salt) {
    let hash = crypto.createHmac("sha512", salt);
    hash.update(password);
    return hash.digest("hex");
}

/**
 * @param {string} user
 * @returns {{username: string, password: string, salt: string}}
 */
function parseUser(user) {
    user = JSON.parse(user);
    const username = user.username.trim();
    const password = user.password.trim();
    if (username.length === 0) {
        throw new Error("Username cannot be empty");
    }
    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
    }

    const salt = generateSalt(SALT_BIT_SIZE / 4);
    const hashed = hash(password, salt);
    return {
        username: username,
        password: hashed,
        salt: salt,
    };
}

/**
 * @param {{username: string, password: string, salt: string}} user
 * @returns {Promise<void>}
 */
async function putOne(user) {
    await dynamo.send(
        new PutCommand({
            TableName: TABLE_NAME,
            ConditionExpression: "attribute_not_exists(username)",
            Item: {
                username: user.username,
                password: user.password,
                salt: user.salt,
            },
        })
    );
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

    try {
        await putOne(user);
    } catch (err) {
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return {
                statusCode: 409,
                body: `User ${user.username} already exists`,
            };
        }

        return {
            statusCode: 500,
            body: "Internal server error",
        };
    }

    return {
        statusCode: 200,
        body: `Successfully created user ${user.username}`,
    };
}

module.exports = { handler };
