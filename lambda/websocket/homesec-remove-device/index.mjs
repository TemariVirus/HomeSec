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
import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const iotData = new IoTDataPlaneClient({});
const s3 = new S3Client({});

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
 */
async function removeDevice(username, deviceId) {
    const devices = await getDevices(username);
    const index = devices.findIndex((d) => d.deviceId === deviceId);
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

    if (devices[index].type === "camera") {
        await deleteDeviceClips(username, deviceId);
    }
}

/**
 * @param {string} username
 * @param {string} deviceId
 */
async function deleteDeviceClips(username, deviceId) {
    const keys = await s3
        .send(
            new ListObjectsV2Command({
                Bucket: process.env.CLIP_BUCKET,
                Prefix: `${username}/${deviceId}/`,
            })
        )
        .then((data) => data.Contents?.map((c) => c.Key));
    await Promise.all(
        keys.map((key) =>
            s3.send(
                new DeleteObjectCommand({
                    Bucket: process.env.CLIP_BUCKET,
                    Key: key,
                })
            )
        )
    );
}

/**
 * @param {string} username
 * @param {string} deviceId
 */
async function disconnectDevice(username, deviceId) {
    await iotData.send(
        new PublishCommand({
            topic: `homesec/command/${username}/${deviceId}`,
            qos: 1,
            payload: JSON.stringify({
                action: "remove-device",
            }),
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

    try {
        await disconnectDevice(username, deviceId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to disconenct device",
        };
    }

    return {
        statusCode: 200,
    };
}
