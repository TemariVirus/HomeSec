/* Expected event body: {
 *     "action": "list-clips",
 *     "data": string,
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
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
 * @param {string} deviceId
 * @returns {Promise<string[]>}
 */
async function listClips(username, deviceId) {
    const data = await s3.send(
        new ListObjectsV2Command({
            Bucket: process.env.CLIP_BUCKET,
            Prefix: `${username}/${deviceId}/`,
        })
    );
    return data.Contents.map((clip) => clip.Key.split("/")[2]).filter(
        (clip) => clip
    );
}

export async function handler(event) {
    let body;
    try {
        body = JSON.parse(event.body);
        if (!body?.data) {
            return {
                statusCode: 400,
                body: "Invalid request body",
            };
        }
    } catch (err) {
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

    const deviceId = body.data;
    let clips;
    try {
        clips = await listClips(username, deviceId);
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: "Error listing clips",
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ action: body.action, data: clips }),
    };
}
