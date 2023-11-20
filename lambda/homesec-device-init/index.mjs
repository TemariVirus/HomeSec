/* Expected event: {
 *     "data": object,
 *     "deviceId": string,
 *     "username": string,
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
    DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    IoTDataPlaneClient,
    PublishCommand,
} from "@aws-sdk/client-iot-data-plane";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const iotData = new IoTDataPlaneClient({});

/**
 * @param {object} data
 * @returns {{ streamUrl: string } | null}
 */
function transformCamera(data) {
    if (
        typeof data.streamUrl !== "string"
        // TODO: Validate stream URL
    ) {
        return null;
    }

    return { streamUrl: data.streamUrl };
}

/**
 * @param {object} data
 * @returns {{ isOpen: boolean } | null}
 */
function transformContact(data) {
    if (typeof data.isOpen !== "boolean") {
        return null;
    }

    return { isOpen: data.isOpen };
}

/**
 * @param {object} data
 * @returns {{ isOpen: boolean } | null}
 */
function transformShock(data) {
    if (typeof data.isOpen !== "boolean") {
        return null;
    }

    return { isOpen: data.isOpen };
}

/**
 * @param {object} deviceType
 * @returns {object | null}
 */
function parseDevice(data) {
    // Verify common fields
    if (
        typeof data.battery !== "number" ||
        typeof data.type !== "string" ||
        data.battery < 0 ||
        data.battery > 100
    ) {
        return null;
    }

    let device;
    switch (data.type) {
        case "camera":
            device = transformCamera(data);
            break;
        case "contact":
            device = transformContact(data);
            break;
        case "shock":
            device = transformShock(data);
            break;
    }
    if (!device) {
        return null;
    }

    device.battery = data.battery;
    device.type = data.type;
    return device;
}

async function deletePending(username, deviceId) {
    const key = `${username}/${deviceId}`;
    const res = await dynamo.send(
        new DeleteCommand({
            TableName: process.env.DEVICE_TABLE,
            Key: {
                key: key,
            },
            ReturnValues: "ALL_OLD",
        })
    );
    return res.Attributes;
}

/**
 * @param {string} username
 * @param {object} device
 * @returns {Promise<void>}
 */
async function addDevice(username, device) {
    const res = await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "SET devices = list_append(devices, :device)",
            ExpressionAttributeValues: {
                ":device": [device],
            },
            ReturnValues: "ALL_OLD",
        })
    );
    return res.Attributes?.topicName;
}

export async function handler(event) {
    const username = event.username;
    const deviceId = event.deviceId;
    const device = parseDevice(event.data);
    if (!device) {
        return;
    }

    const old = await deletePending(username, deviceId);
    if (!old) {
        return;
    }

    device.id = deviceId;
    device.name = old.name;
    const topicName = await addDevice(username, device);
    await iotData.send(
        new PublishCommand({
            topic: `homesec/init/${username}/${deviceId}`,
            qos: 1,
            payload: JSON.stringify({
                action: "user-topic",
                data: topicName,
            }),
        })
    );
}
