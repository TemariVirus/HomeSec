/* Expected event body: {
 *     "action": "cancel-add-device",
 *     "data": string,
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

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
 * @param {string} deviceId
 * @returns {Promise<void>}
 */
async function removeDevice(username, deviceId) {
    await dynamo.send(
        new DeleteCommand({
            TableName: process.env.DEVICE_TABLE,
            Key: {
                key: `${username}/${deviceId}`,
            },
        })
    );
}

export async function handler(event) {
    let body;
    try {
        body = JSON.parse(event.body);
    } catch (err) {
        return {
            statusCode: 400,
            body: "Invalid request body",
        };
    }

    const deviceId = body?.data;
    if (typeof deviceId !== "string" || deviceId.length === 0) {
        return {
            statusCode: 400,
            body: "Invalid request body",
        };
    }

    const connectionId = event.requestContext.connectionId;
    const username = await getUsername(connectionId);
    if (!username) {
        return {
            statusCode: 401,
            body: "No user found for connection",
        };
    }

    try {
        await removeDevice(username, deviceId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to add device",
        };
    }

    return {
        statusCode: 200,
    };
}
