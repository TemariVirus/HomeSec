"use strict";
import { createHmac, randomBytes } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const SALT_BIT_SIZE = 128;

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/**
 * @param {number} length
 * @returns {string}
 */
function generateSalt(length) {
    return randomBytes(Math.ceil(length / 2))
        .toString("hex")
        .slice(0, length);
}

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
    if (username.length > 255) {
        throw new Error("Username cannot be longer than 255 characters");
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
async function putUser(user) {
    await dynamo.send(
        new PutCommand({
            TableName: process.env.USER_TABLE,
            ConditionExpression: "attribute_not_exists(username)",
            Item: {
                username: user.username,
                password: user.password,
                salt: user.salt,
                isArmed: false,
                devices: [],
            },
        })
    );
}

export async function handler(event) {
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
        await putUser(user);
    } catch (err) {
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return {
                statusCode: 409,
                body: `User ${user.username} already exists`,
            };
        }

        console.error(err);
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
