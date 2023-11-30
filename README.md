# HomeSec

HomeSec is an IoT-based home security system created as a school project. It can use camera, shock, and contact sensors, and provides a dashboard accessible from the browser.

## DynamoDB Table Schemas

### homesec

Stores information about each user.

| name         | type    | description                               |
| ------------ | ------- | ----------------------------------------- |
| username     | string  | The name of the user (partition key)      |
| password     | string  | The user's password, hashed               |
| salt         | string  | The salt used to hash the user's password |
| phoneNo      | string  | The user's phone number                   |
| isArmed      | boolean | Whether the user's home system is armed   |
| devices      | list    | The user's devices                        |
| sessionId    | string  | The user's current session ID             |
| connectionId | string  | The user's current connection ID          |
| pending      | string  | The ID of the device the user is adding   |

### homesec-connections

Stores the user of each connection to avoid scanning the entire `homesec` table when using the websocket API.

| name     | type   | description                                                     |
| -------- | ------ | --------------------------------------------------------------- |
| id       | string | The connection ID of the user's current session (partition key) |
| username | string | The name of the user                                            |

## API Gateway configuration

### HomeSec User

A REST API. Used for creating and deleting users, and for logging in and out.

CORS is enabled for all routes.
For all routes, gateway responses were configured for default 4XX and 5XX responses.
All applicable values were added to the `Access-Control-Allow-Methods` header.
The `Access-Control-Allow-Headers` header was set to `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token`.
The `Access-Control-Allow-Origin` header was set to `*`.

| method | path    | lambda function  | lambda proxy integration |
| ------ | ----    | ---------------  | ------------------------ |
| POST   | /       | homesec-register | True                     |
| DELETE | /       | homesec-delete   | True                     |
| POST   | /login  | homesec-login    | True                     |
| DELETE | /login  | homesec-logout   | True                     |

### HomeSec Dashboard

A WebSocket API. Used for connecting, disconnecting, sending data, and receiving data to and from the cloud and the frontend in real-time.

| route             | lambda function           | lambda proxy integration | two-way |
| ----------------- | ------------------------- | ------------------------ | ------- |
| $connect          | homesec-connect           | True                     | No      |
| $disconnect       | homesec-disconnect        | True                     | No      |
| add-device        | homesec-add-device        | True                     | Yes     |
| cancel-add-device | homesec-cancel-add-device | True                     | No      |
| get-clip          | homesec-get-clip          | True                     | Yes     |
| get-info          | homesec-get-info          | True                     | Yes     |
| list-clips        | homesec-list-clips        | True                     | Yes     |
| remove-device     | homesec-remove-device     | True                     | No      |
| set-armed         | homesec-set-armed         | True                     | No      |

## Deployment

HomeSec's frontend is optimised to be deployed on AWS Amplify. To build and run it locally, you will need to manually create a file named `.env` in the `frontend/` directory as shown below:

```env
PUBLIC_USER_API=https://[your REST API URL]
PUBLIC_WEBSOCKET_API=wss://[your Websocket API URL]
```

The `lambda/` directory contains the various Lambda functions used by the backend. Each folder in the `rest/` folder contains a lambda function used for the API Gateway REST API, and each folder in the `websocket/` folder contains a lambda function used for the API Gateway Websocket API, and each folder in the `rules-engine/` folder contains a lambda function used for IoT Rules Engine. The `index.mjs` file in each folder in the `rules-engine/` folder also contains the SQL statement used for that rule.

## Build and run the frontend locally

```bash
$ cd ./frontend 
$ npm ci
$ npm run build
$ npm run preview -- --open
```

## Connecting IoT devices

HomeSec currently does not have any physical sensors to connect to the system. However, the `demo/` directory contains everything needed to simulate an IoT sensor. You will need to create your own IoT endpoint via IoT Core and provide your certificates and keys. Once you have done so, you can run the following commands to begin simulating a device:

```bash
$ cd ./demo
$ npm ci
$ node ./device-sim.js -u [your username] -t [the device type] -d [the device ID]
```

The device ID will be provided by the dashboard after you click the "Add device" button.

## Simulating a device

When the simulated device first connects to the IoT endpoint, it automatically generates random data for the device and publishes it. To send your own data, you can type a stringified JSON object into the console, followed by a newline, like so: `{"yourField": "yourValue"}`. To randomise all fields again, type `random` into the console and press enter.

Upon being removed through the dashboard, the simulated device will automatically disconnect itself from the IoT endpoint.
