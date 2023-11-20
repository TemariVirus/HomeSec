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
import {
    IoTDataPlaneClient,
    PublishCommand,
} from "@aws-sdk/client-iot-data-plane";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const iotData = new IoTDataPlaneClient({});

/**
 * @param {string} connectionId
 * @returns {Promise<{username: string, topicName: string} | null>}
 */
async function getUser(connectionId) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.CONNECTION_TABLE,
            Key: {
                id: connectionId,
            },
            ProjectionExpression: "username, topicName",
        })
    );

    return data.Item ?? null;
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

    const user = await getUser(connectionId);
    if (!user) {
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
        await removeDevice(user.username, deviceId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to remove device",
        };
    }

    try {
        await iotData.send(
            new PublishCommand({
                topic: `homesec/command/${user.topicName}/${deviceId}`,
                qos: 1,
                payload: JSON.stringify({
                    action: "remove-device",
                }),
            })
        );
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to send command to device",
        };
    }

    return {
        statusCode: 200,
    };
}
