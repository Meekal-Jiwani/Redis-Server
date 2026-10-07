const net = require("net");
const assert = require("node:assert");
const {before, after, test} = require("node:test"); 
const { buildRedisCommand } = require("../src/utils");

let redisClient; // Redis client instance

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
        
        redisClient.write(buildRedisCommand(command));
        
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
    assert.strictEqual(getResponse, "$3\r\nbar\r\n");   
});


// Test case to check if the server returns $-1 for a non-existent key
test("should return $-1 for a non-existent key", async () => {
  const getResponse = await sendCommand("get foo1");
  assert.strictEqual(getResponse, "$-1\r\n");
});


// Test case to check if the server can handle DEL command
test("should DEL a key", async () => {
  await sendCommand("set fooDel poorBar");
  const delResponse = await sendCommand("del fooDel");
  assert.strictEqual(delResponse, ":1\r\n");

  const getResponse = await sendCommand("get fooDel");
  assert.strictEqual(getResponse, "$-1\r\n");
});


// Test case to check if the server can handle EXPIRE command
test("should EXPIRE a key", async () => {
  await sendCommand("set fooExp expBar");
  const expireResponse = await sendCommand("expire fooExp 1");
  assert.strictEqual(expireResponse, ":1\r\n");

  await new Promise((resolve) => setTimeout(resolve, 1100)); // wait for 1.1 seconds

  const getResponse = await sendCommand("get fooExp");
  assert.strictEqual(getResponse, "$-1\r\n");
});


// Test case to check if the server can handle wrong number of arguments for SET command
test("should handle unknown commands gracefully", async () => {
  const response = await sendCommand("UNKNOWN test");
  assert.strictEqual(response, "-ERR unknown command\r\n");
});
