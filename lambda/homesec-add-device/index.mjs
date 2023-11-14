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
 * @param {object} data
 * @returns {{
 *     name: string,
 *     streamUrl: string,
 *     battery: number,
 * } | null}
 */
function transformCamera(data) {
    if (
        typeof data.name !== "string" ||
        typeof data.streamUrl !== "string" ||
        typeof data.battery !== "number" ||
        data.name.length === 0 ||
        // TODO: Validate stream URL
        data.battery < 0 ||
        data.battery > 100
    ) {
        return null;
    }

    return {
        name: data.name,
        streamUrl: data.streamUrl,
        battery: data.battery,
    };
}

/**
 * @param {object} deviceType
 * @returns {object | null}
 */
function parseDevice(body) {
    const data = JSON.parse(body);
    let device;
    switch (data.type) {
        case "camera":
            device = transformCamera(data);
            break;
        case "contact":
            break;
        case "shock":
            break;

        default:
            return null;
    }

    // TODO: add device ID
    return device;
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

    // TODO: Add device to user table

    return {
        statusCode: 200,
    };
}
