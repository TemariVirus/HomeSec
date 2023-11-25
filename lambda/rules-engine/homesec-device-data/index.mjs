/* SQL statement: SELECT * AS data, topic(3) AS username, topic(4) AS deviceId FROM 'homesec/data/+/+'
 * Expected event: {
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
 * @param {object} info
 * @returns {Promise<{
 *     connectionId: string | undefined,
 *     device: object | undefined,
 *     isArmed: boolean | undefined,
 * }>}
 */
async function updateDeviceInfo(username, deviceId, info) {
    const devices = await getDevices(username);
    const index = devices.findIndex((d) => d.deviceId === deviceId);
    if (index === -1) {
        return;
    }

    const device = {
        ...devices[index],
        ...info,
    };
    const res = await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: `SET devices[${index}] = :device`,
            ExpressionAttributeValues: {
                ":device": device,
            },
            ReturnValues: "ALL_NEW",
        })
    );
    return {
        connectionId: res.Attributes?.connectionId,
        device: device,
        isArmed: res.Attributes?.isArmed,
    };
}

export async function handler(event) {
    const username = event.username;
    const deviceId = event.deviceId;
    const data = event.data;
    if (!data) {
        return;
    }

    const { connectionId, device, isArmed } = await updateDeviceInfo(
        username,
        deviceId,
        data
    );
    if (!connectionId) {
        return;
    }

    await apiGateway.send(
        new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
                action: "update-device",
                data: {
                    ...data,
                    deviceId: deviceId,
                },
            }),
        })
    );

    if (isArmed && device.isOpen) {
        // TODO: Send notification to user
    }

    return;
}
