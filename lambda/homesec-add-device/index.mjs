/* Expected event body: {
 *     "action": "add-device",
 *     "data": JSON.stringify({
 *         "name": string,
 *         "battery": number,
 *         "type": "camera" | "contact" | "shock",
 *         "streamUrl": string?,
 *         "isOpen": boolean?,
 *     }),
 * }
 */

"use strict";
import { randomBytes } from "crypto";
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
    // Assume window/door is not broken when device is added
    return { isOpen: false };
}

/**
 * @param {object} deviceType
 * @returns {object | null}
 */
function parseDevice(body) {
    const data = JSON.parse(body ?? "{}").data ?? {};

    // Verify common fields
    if (
        typeof data.name !== "string" ||
        typeof data.battery !== "number" ||
        typeof data.type !== "string" ||
        data.name?.length === 0 ||
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

    device.id = randomBytes(9).toString("base64");
    device.name = data.name;
    device.battery = data.battery;
    device.type = data.type;
    return device;
}

/**
 * @param {string} username
 * @param {object} device
 * @returns {Promise<void>}
 */
async function addDevice(username, device) {
    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "SET #d = list_append(#d, :device)",
            ExpressionAttributeNames: {
                "#d": "devices",
            },
            ExpressionAttributeValues: {
                ":device": [device],
            },
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

    const device = parseDevice(event.body);
    if (!device) {
        return {
            statusCode: 400,
            body: "Invalid device info",
        };
    }

    try {
        await addDevice(username, device);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to add device",
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify(device),
    };
}
