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
    UpdateCommand,
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
 */
async function removePending(username, deviceId) {
    await dynamo.send(
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
        await removePending(username, deviceId);
    } catch (err) {
        // Device is considered already removed if the condition check failed
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return {
                statusCode: 200,
            };
        }

        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to remove pending device",
        };
    }

    return {
        statusCode: 200,
    };
}
