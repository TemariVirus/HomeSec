"use strict";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * @param {string} token
 * @returns {{username: string, sessionId: string}}
 */
function decodeToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS512"],
        ignoreExpiration: false,
    });
    return {
        username: payload.username,
        sessionId: payload.sessionId,
    };
}

/**
 * @param {string} username
 */
async function deleteSession(username) {
    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "REMOVE sessionId",
        })
    );
}

/**
 * @param {number} status
 * @param {string | undefined} body
 * @returns {{
 *     statusCode: number,
 *     headers: {
 *         Content-Type: string,
 *         Access-Control-Allow-Origin: string,
 *         Access-Control-Allow-Methods: string
 *     },
 *     body: string
 * }}
 */
function formatResponse(status, body) {
    return {
        statusCode: status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
        },
        body: body,
    };
}

export async function handler(event) {
    const auth = event.headers.Authorization;
    if (!auth) {
        return formatResponse(401, "No authorization header");
    }

    const token = auth.split(" ")[1];
    if (auth.split(" ")[0] != "Bearer" || !token) {
        return formatResponse(401, "No bearer token");
    }

    let payload;
    try {
        payload = decodeToken(token);
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return formatResponse(401, "Token expired");
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return formatResponse(401, "Invalid token");
        }

        console.error(err);
        return formatResponse(500, "Unable to verify token");
    }

    try {
        await deleteSession(payload.username);
    } catch (err) {
        console.error(err);
        return formatResponse(500, "Unable to delete login session");
    }
    return formatResponse(200);
}
