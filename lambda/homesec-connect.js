"use strict";

async function handler(event) {
    const auth = event.headers.TestAuth;
    if (auth !== "abcd1234") {
        return {
            statusCode: 401,
        };
    }

    // add connecttion id to database
    //

    return {
        statusCode: 200,
    };
}

module.exports = { handler };

// call with
// wscat -c wss://yjrwbj2w60.execute-api.us-east-1.amazonaws.com/Prod/ -H TestAuth:abcd1234
