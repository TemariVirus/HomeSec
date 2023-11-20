"use strict";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
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
 * @returns {Promise<{sessionId: string, topicName: string} | null>}
 */
async function getUserInfo(username) {
    const result = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "sessionId, topicName",
        })
    );
    return result.Item ?? null;
}

/**
 * @param {string} connectionId
 * @param {string} username
 * @param {string} topicName
 * @returns {Promise<void>}
 */
async function putConnection(connectionId, username, topicName) {
    await dynamo.send(
        new PutCommand({
            TableName: process.env.CONNECTION_TABLE,
            Item: {
                id: connectionId,
                username: username,
                topicName: topicName,
            },
        })
    );
}

export async function handler(event) {
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

    let userInfo;
    try {
        userInfo = await getUserInfo(payload.username, payload.sessionId);
        if (userInfo?.sessionId !== payload.sessionId) {
            return {
                statusCode: 401,
                body: "Invalid login session",
            };
        }
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to verify login session",
        };
    }

    const connectionId = event.requestContext.connectionId;
    try {
        await putConnection(connectionId, payload.username, userInfo.topicName);
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
