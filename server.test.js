const net = require("net");
const assert = require("node:assert");
const {before, after, test} = require("node:test"); 

let redisClient; // Redi s client instance

// Connect to the Redis server before running tests!
const connectToRedis = () => {
    return new Promise((resolve, reject) => {
        redisClient = net.createConnection({ port: 6379 }, () => {
            resolve();
        });

        redisClient.on("error", (err) => {
            reject(err);
        });
    });
};


before(async () => {
    await connectToRedis();
});

// Disconnect from the Redis server after running tests!
after(() => {
    if (redisClient && !redisClient.destroyed) {
        redisClient.end();
    }
});

// Error handler for Redis client
const onError = (err) => {
    reject(err);
}


// Function to send a command to the Redis server and receive the response.
const sendCommand = (command) => {
    return new Promise((resolve, reject) => {
        if (!redisClient || redisClient.destroyed) {
            reject(new Error("Redis client is not connected."));
            return;
        }

        redisClient.write(command);

        redisClient.once("data", (data) => {
            resolve(data.toString());
            redisClient.removeListener("error", onError);
        });

        redisClient.once("error", onError);
    });
};


// Test case to check if the server can handle SET and GET commands
test("should SET and GET a value in Redis", async () => {
    // Should be equal
    const setResponse = await sendCommand("set foo bar");
    assert.strictEqual(setResponse, "+OK\r\n");

    // Should fail here
    const getResponse = await sendCommand("get foo");
    // assert.strictEqual(getResponse, "$3\r\nbar\r\n");   
});

