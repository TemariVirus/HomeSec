"use strict";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    UpdateCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * @param {string} token
 * @returns {{username: string, sessionId: string}}
 */
function decodeToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS512"],
        ignoreExpiration: false,
    });
    return {
        username: payload.username,
        sessionId: payload.sessionId,
    };
}

/**
 * @param {string} username
 * @param {string} sessionId
 * @param {string} connectionId
 */
async function updateUserInfo(username, sessionId, connectionId) {
    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "SET connectionId = :connectionId",
            ConditionExpression: "sessionId = :sessionId",
            ExpressionAttributeValues: {
                ":connectionId": connectionId,
                ":sessionId": sessionId,
            },
        })
    );
}

/**
 * @param {string} connectionId
 * @param {string} username
 */
async function putConnection(connectionId, username) {
    await dynamo.send(
        new PutCommand({
            TableName: process.env.CONNECTION_TABLE,
            Item: {
                id: connectionId,
                username: username,
            },
        })
    );
}

export async function handler(event) {
    const connectionId = event.requestContext.connectionId;
    const token = event.queryStringParameters?.token;
    if (!token) {
        return {
            statusCode: 401,
            body: "Missing Authorization token",
        };
    }

    let payload;
    try {
        payload = decodeToken(token);
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return {
                statusCode: 401,
                body: "Token expired",
            };
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return {
                statusCode: 401,
                body: "Invalid token",
            };
        }

        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to verify token",
        };
    }

    try {
        await updateUserInfo(payload.username, payload.sessionId, connectionId);
    } catch (err) {
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return {
                statusCode: 401,
                body: "Invalid login session",
            };
        }

        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to verify login session",
        };
    }

    try {
        await putConnection(connectionId, payload.username);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to save connection ID to database",
        };
    }

    return {
        statusCode: 200,
    };
}
