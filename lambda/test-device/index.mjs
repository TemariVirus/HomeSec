import { mqtt, iot } from "aws-iot-device-sdk-v2";
import readline from "readline";

const CERT_PATH =
    "de650b9acbfee3e724de1a1f846d10ed943d1fb16f4b6803e3ce3b6e7a31db2a-certificate.pem.crt";
const KEY_PATH =
    "de650b9acbfee3e724de1a1f846d10ed943d1fb16f4b6803e3ce3b6e7a31db2a-private.pem.key";
const CA_PATH = "AmazonRootCA1.pem";
const ENDPOINT = "a1ujiwut160nuw-ats.iot.us-east-1.amazonaws.com";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const dec = new TextDecoder();

// Creates and returns a MQTT connection using a certificate file and key file
function build_connection() {
    let config_builder =
        iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
            CERT_PATH,
            KEY_PATH
        );

    config_builder.with_certificate_authority_from_path(undefined, CA_PATH);

    config_builder.with_clean_session(false);
    config_builder.with_client_id(
        "test-" + Math.floor(Math.random() * 100000000)
    );
    config_builder.with_endpoint(ENDPOINT);
    const config = config_builder.build();

    const client = new mqtt.MqttClient();
    return client.new_connection(config);
}

const connection = build_connection();

console.log("Connecting...");
await connection.connect();
console.log("Connection completed.");

connection.subscribe("ttt", mqtt.QoS.AtLeastOnce, (topic, payload) => {
    const str = dec.decode(payload);
    const data = JSON.parse(str);
    console.log(
        `Received message from topic [${topic}]: ${JSON.stringify(data)}`
    );
});

connection.publish(
    "ttt",
    JSON.stringify({ hello: "world" }),
    mqtt.QoS.AtLeastOnce
);

rl.on("close", async function () {
    console.log("Disconnecting...");
    await connection.disconnect();
    console.log("Disconnect completed.");

    process.exit(0);
});
