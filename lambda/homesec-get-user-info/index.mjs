// TODO: rewrite
"use strict";
import jwt from "jsonwebtoken";
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
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
 * @returns {Promise<{isArmed: boolean, devices: object[], sessionId: string} | null>}
 */
async function getUserInfo(username) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "isArmed, devices, sessionId",
        })
    );
    return data.Item ?? null;
}

/**
 * @param {string} connectionId
 * @param {string} username
 * @returns {Promise<void>}
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

/**
 * @param {{domainName: string, stage: string, connectionId: string}} context
 * @param {{isArmed: boolean, devices: object[]}} info
 * @returns {Promise<void>}
 */
async function sendUserInfo(context, info) {
    const domain = context.domainName;
    const stage = context.stage;
    const wsApiClient = new ApiGatewayManagementApiClient({
        endpoint: `https://${domain}/${stage}/`,
    });

    await wsApiClient.send(
        new PostToConnectionCommand({
            ConnectionId: context.connectionId,
            Data: JSON.stringify({
                isArmed: info.isArmed,
                devices: info.devices,
            }),
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

    let userInfo;
    try {
        userInfo = await getUserInfo(payload.username);
        if (!userInfo) {
            return {
                statusCode: 401,
                body: "User not found",
            };
        }
        if (userInfo.sessionId !== payload.sessionId) {
            return {
                statusCode: 401,
                body: "Session expired",
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
        await putConnection(connectionId, payload.username);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to save connection ID to database",
        };
    }

    try {
        await sendUserInfo(event.requestContext, userInfo);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to send user info",
        };
    }

    return {
        statusCode: 200,
    };
}
