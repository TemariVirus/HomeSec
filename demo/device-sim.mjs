// Device responsibilities:
// - send all info when connected
// - send all info when requested
// - send state info when changed
// - disconnect when removed
import { mqtt, iot } from "aws-iot-device-sdk-v2";
import readline from "readline";

const CERT_PATH =
    "de650b9acbfee3e724de1a1f846d10ed943d1fb16f4b6803e3ce3b6e7a31db2a-certificate.pem.crt";
const KEY_PATH =
    "de650b9acbfee3e724de1a1f846d10ed943d1fb16f4b6803e3ce3b6e7a31db2a-private.pem.key";
const CA_PATH = "AmazonRootCA1.pem";
const ENDPOINT = "a1ujiwut160nuw-ats.iot.us-east-1.amazonaws.com";

const USERNAME = "test";
const DEVICE_ID = "CTf3745VvOlF";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const decoder = new TextDecoder();

function build_connection() {
    let config_builder =
        iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
            CERT_PATH,
            KEY_PATH
        );

    config_builder.with_certificate_authority_from_path(undefined, CA_PATH);

    config_builder.with_clean_session(false);
    config_builder.with_client_id(DEVICE_ID);
    config_builder.with_endpoint(ENDPOINT);
    const config = config_builder.build();

    const client = new mqtt.MqttClient();
    return client.new_connection(config);
}

const connection = build_connection();

await connection.connect();
console.log("Connected.");

rl.on("close", async function () {
    await connection.disconnect();
    console.log("Disconnected.");
    process.exit(0);
});

connection.subscribe(USERNAME, mqtt.QoS.AtLeastOnce, (topic, payload) => {
    const str = decoder.decode(payload);
    const data = JSON.parse(str);
    console.log(
        `Received message from topic [${topic}]: ${JSON.stringify(data)}`
    );
});

connection.publish(
    `${USERNAME}${DEVICE_ID}`,
    JSON.stringify({ hello: "world" }),
    mqtt.QoS.AtLeastOnce
);
