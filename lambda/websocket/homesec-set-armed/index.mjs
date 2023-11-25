/* Expected event body: {
 *     "action": "set-armed",
 *     "data": boolean,
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
 * @param {boolean} isArmed
 */
async function setArmed(username, isArmed) {
    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "SET isArmed = :isArmed",
            ExpressionAttributeValues: {
                ":isArmed": isArmed,
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

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (err) {
        return {
            statusCode: 400,
            body: "Invalid JSON body",
        };
    }

    const isArmed = body?.data;
    if (typeof isArmed !== "boolean") {
        return {
            statusCode: 400,
            body: "Invalid value",
        };
    }

    try {
        await setArmed(username, isArmed);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to set armed status",
        };
    }

    return {
        statusCode: 200,
    };
}
