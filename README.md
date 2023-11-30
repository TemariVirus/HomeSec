# HomeSec

HomeSec is a simple IoT-based home security system. It can use camera, shock, and contact sensors, and provides a dashboard accessible from the browser.

## Deployment

HomeSec's frontend is optimised to be deployed on AWS Amplify. To build and run it locally, you will need to manually create a file named `.env` in the `frontend/` directory as shown below:

```env
PUBLIC_USER_API=https://[your REST API URL]
PUBLIC_WEBSOCKET_API=wss://[your Websocket API URL]
```

The `lambda/` directory contains the various Lambda functions used by the backend. Each folder in the `rest/` folder contains a lambda function used for the API Gateway REST API, and each folder in the `websocket/` folder contains a lambda function used for the API Gateway Websocket API, and each folder in the `rules-engine/` folder contains a lambda function used for IoT Rules Engine.

## Build and run the dashboard locally

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
