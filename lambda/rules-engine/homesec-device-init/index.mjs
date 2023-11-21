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
} from "@aws-sdk/lib-dynamodb";
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: process.env.WS_ENDPOINT,
});

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

/**
 * @param {string} username
 * @param {string} deviceId
 * @returns {Promise<{ deviceId: string, name: string } | null>}
 */
async function removePending(username, deviceId) {
    const res = await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "REMOVE pending",
            ConditionExpression: "pending.deviceId = :deviceId",
            ExpressionAttributeValues: {
                ":deviceId": deviceId,
            },
            ReturnValues: "ALL_OLD",
        })
    );
    return res.Attributes?.pending ?? null;
}

/**
 * @param {string} username
 * @param {object} device
 */
async function addDevice(username, device) {
    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "SET devices = list_append(devices, :device)",
            ExpressionAttributeValues: {
                ":device": [device],
            },
        })
    );
}

/**
 * @param {string} username
 * @returns {Promise<string | null>}
 */
async function getConnectionId(username) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "connectionId",
        })
    );
    return data.Item?.connectionId ?? null;
}

export async function handler(event) {
    const username = event.username;
    const deviceId = event.deviceId;
    const device = parseDevice(event.data);
    if (!device) {
        return;
    }

    const pending = await removePending(username, deviceId);

    device.deviceId = deviceId;
    device.name = pending.name;
    await addDevice(username, device);

    const connectionId = await getConnectionId(username);
    if (!connectionId) {
        return;
    }
    await apiGateway.send(
        new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
                action: "add-device-complete",
                data: device,
            }),
        })
    );
}
