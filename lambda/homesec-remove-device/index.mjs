/* Expected event body: {
 *     "action": "remove-device",
 *     "data": string,
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/**
 * @param {string} connectionId
 * @returns {Promise<string | null>}
 */
async function getUsername(connectionId) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.CONNECTION_TABLE,
            Key: {
                id: connectionId,
            },
            ProjectionExpression: "username",
        })
    );

    return data.Item?.username ?? null;
}

/**
 * @param {string} username
 * @returns {Promise<object[]>}
 */
async function getDevices(username) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "devices",
        })
    );

    return data.Item?.devices ?? [];
}

/**
 * @param {string} username
 * @param {string} deviceId
 * @returns {Promise<void>}
 */
async function removeDevice(username, deviceId) {
    const devices = await getDevices(username);
    const index = devices.findIndex((d) => d.id === deviceId);
    if (index === -1) {
        return;
    }

    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: `REMOVE devices[${index}]`,
        })
    );
}

export async function handler(event) {
    const connectionId = event.requestContext.connectionId;

    const username = await getUsername(connectionId);
    if (!username) {
        return {
            statusCode: 401,
            body: "No user found for connection",
        };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (err) {
        return {
            statusCode: 400,
            body: "Invalid JSON body",
        };
    }

    const deviceId = body?.data;
    if (!deviceId) {
        return {
            statusCode: 400,
            body: "No device ID provided",
        };
    }

    try {
        await removeDevice(username, deviceId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to remove device",
        };
    }

    return {
        statusCode: 200,
    };
}
