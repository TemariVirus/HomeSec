"use strict";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

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
 * @returns {Promise<boolean>}
 */
async function verifySession(username, sessionId) {
    const result = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "sessionId",
        })
    );
    if (!result.Item) {
        return false;
    }

    return result.Item.sessionId === sessionId;
}

/**
 * @param {string} connectionId
 * @param {string} username
 * @returns {Promise<void>}
 */
async function putOne(connectionId, username) {
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
    if (!event.headers.Authorization) {
        return {
            statusCode: 401,
            body: "Missing Authorization header",
        };
    }

    const auth = event.headers.Authorization;
    const authType = auth.split(" ")[0];
    if (authType !== "Bearer") {
        return {
            statusCode: 401,
            body: "Requires JWT bearer token in Authorization header",
        };
    }

    const token = auth.split(" ")[1];
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
        const sessionExists = await verifySession(
            payload.username,
            payload.sessionId
        );
        if (!sessionExists) {
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
        await putOne(connectionId, payload.username);
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
