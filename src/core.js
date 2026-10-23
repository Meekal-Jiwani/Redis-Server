const { parseResp } = require("./utils");
const logger = require("./utils/logger")("core");
const config = require("./config.json");
const persistence = require("./persistence");
const { store, expirationTimes } = persistence;

const isExpired = (key) => 
    expirationTimes[key] && expirationTimes[key] < Date.now(); 

const checkExpiry = (key) => { 
    if (isExpired(key)) {
        delete store[key];
        delete expirationTimes[key];
        
        return true;
    }

    return false;
};


/* This object contains the command handlers for various Redis commands. 
Each command handler is a function that takes an array of arguments and performs 
the corresponding operation on the store. The command handlers return the appropriate 
response based on the operation performed. */
const commandHandlers = { 
    SET: (args) => { 
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'SET' command\r\n";
        }

        const [key, value] = args;
        store[key] = { type: "string", value };
        delete expirationTimes[key]; // Remove any existing expiration time for the key

        return "+OK\r\n";
    },

    GET: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'GET' command\r\n";
        }

        const [key] = args;

        if (checkExpiry(key) || !store[key] || store[key].type !== "string") {
            return "$-1\r\n";
        }

        const value = store[key].value;

        return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    },

    DEL: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'del' command\r\n";
        }

        let deleted = 0;

        for (const key of args) {
            if (!checkExpiry(key) && store[key]) {
                delete store[key];
                delete expirationTimes[key];
                deleted++;
            }
        }

        return `:${deleted}\r\n`;
    },

    EXPIRE: (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'expire' command\r\n";
        }

        const [key, seconds] = args;
        const secs = Number(seconds); 

        // Check if the seconds argument is a valid integer
        if (!Number.isInteger(secs)) {
            return "-ERR value is not an integer or out of range\r\n";
        }
        
        if (checkExpiry(key) || !store[key]) {
            return ":0\r\n";
        }

        expirationTimes[key] = Date.now() + seconds * 1000;
        return ":1\r\n";
    },

    TTL: (args) => {
        if (args.length < 1) {
        return "-ERR wrong number of arguments for 'ttl' command\r\n";
        }

        const [key] = args;

        if (!store[key]) { 
            return ":-2\r\n";
        }

        if (!expirationTimes[key]) { 
            return ":-1\r\n";
        }

        const ttl = Math.floor((expirationTimes[key] - Date.now()) / 1000);

        return ttl > 0 ? `:${ttl}\r\n` : ":-2\r\n";
    },

    INCR: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'incr' command\r\n";
        }

        const [key] = args;
        checkExpiry(key);

        if (!store[key]) {
            store[key] = { type: "string", value: "1" };
            return ":1\r\n";
        }

        const value = parseInt(store[key].value, 10);

        if (isNaN(value)) { 
            return "-ERR value is not an integer or out of range\r\n";
        }
        store[key].value = (value + 1).toString();

        return `:${value + 1}\r\n`;
    },

    DECR: (args) => {
        if (args.length < 1) {
        return "-ERR wrong number of arguments for 'decr' command\r\n";
        }

        const [key] = args;
        checkExpiry(key);

        if (!store[key]) {
        store[key] = { type: "string", value: "-1" };

        return ":-1\r\n";
        }

        const value = parseInt(store[key].value, 10);

        if (isNaN(value)) {
        return "-ERR value is not an integer or out of range\r\n";
        }

        store[key].value = (value - 1).toString();

        return `:${value - 1}\r\n`;
    },

    LRANGE: (args) => {
        if (args.length < 3) {
            return "-ERR wrong number of arguments for 'lrange' command\r\n";
        }

        const [key, start, stop] = args;

        if (checkExpiry(key) || !store[key]) {
            return "*0\r\n";
        }

        if (store[key].type !== "list") {
            return "-ERR wrong type of key\r\n";
        }

        // Get the list associated with the key
        const list = store[key].value;
        let startIndex = parseInt(start, 10);
        let stopIndex = parseInt(stop, 10);

        // Handle negative indices
        if (isNaN(startIndex) || isNaN(stopIndex)) {
            return "-ERR value is not an integer or out of range\r\n";
        }

        // Adjust negative indices to positive indices
        if (startIndex < 0) {
            startIndex = Math.max(list.length + startIndex, 0);
        }
        if (stopIndex < 0) {
            stopIndex = list.length + stopIndex;
        }
        if (stopIndex < 0) {
            return "*0\r\n"; 
        }

        // Ensure the stop index does not exceed the list length
        const range = list.slice(startIndex, stopIndex + 1);

        let response = `*${range.length}\r\n`;

        range.forEach((value) => {
            response += `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
        });

        return response;
    },

    LPUSH: (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'lpush' command\r\n";
        }

        const [key, ...values] = args;

        if (!store[key]) {
            store[key] = { type: "list", value: [] };
        }

        if (store[key].type !== "list") {
            return "-ERR wrong type of key\r\n";
        }

        store[key].value.unshift(...values);

        return `:${store[key].value.length}\r\n`;
    },

    RPUSH: (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'rpush' command\r\n";
        }

        const [key, ...values] = args;

        if (!store[key]) {
            store[key] = { type: "list", value: [] };
        }

        if (store[key].type !== "list") {
            return "-ERR wrong type of key\r\n";
        }

        store[key].value.push(...values);

        return `:${store[key].value.length}\r\n`;
    },

    LPOP: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'lpop' command\r\n";
        }

        const [key] = args;

        if (
            checkExpiry(key) ||
            !store[key] ||
            store[key].type !== "list" ||
            store[key].value.length === 0
        ) {
            return "$-1\r\n";
        }

        const value = store[key].value.shift();

        return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    },

    RPOP: (args) => {
        if (args.length < 1) {
            return "-ERR wrong number of arguments for 'rpop' command\r\n";
        }

        const [key] = args;

        if (
        checkExpiry(key) ||
        !store[key] ||
        store[key].type !== "list" ||
        store[key].value.length === 0
        ) {
            return "$-1\r\n";
        }

        const value = store[key].value.pop();

        return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
    },

    FLUSHALL: () => {
        persistence.flushAll();
        return "+OK\r\n";
    },

    PEXPIREAT: (args) => {
        if (args.length < 2) {
            return "-ERR wrong number of arguments for 'pexpireat' command\r\n";
        }

        const [key, timestamp] = args;
        const deadline = Number(timestamp);

        if (!Number.isInteger(deadline)) {
            return "-ERR value is not an integer or out of range\r\n";
        }

        if (checkExpiry(key) || !store[key]) {
            return ":0\r\n";
        }

        expirationTimes[key] = deadline;
        return ":1\r\n";
    },

    COMMAND: () => "+OK\r\n",
};


/* This function is used to execute a command with its arguments. It checks if the 
command exists in the commandHandlers object and executes it. If the command is not found, 
it returns an error message. If the command is executed successfully, it returns the 
result of the command execution. */
const executeCommand = (command, args, replayingFromAOF = false) => {
    // Log the command and its arguments, along with whether it's being replayed from AOF
    logger.info(`Received ${command} ${args.join(" ")}${replayingFromAOF ? " (AOF replay)" : ""}`);

    const handler = commandHandlers[command];

    if (!handler) {
        return "-ERR unknown command\r\n";
    }

    const result =  handler(args); // Execute the command and get the result

    /* If append-only mode is enabled and the command is one of the 
    AOF commands, append it to the AOF file */
    if (
        config.appendonly &&
        !replayingFromAOF &&
        config.aofCommands.includes(command) &&
        !result.startsWith("-") // Only append successful commands (not errors) 
    ) {
        let logCommand = command;
        let logArgs = args;

        // Log EXPIRE as an absolute deadline so a restart doesn't restart the timer
        if (command === "EXPIRE") {
            if (result !== ":1\r\n") return result;   // key was missing, nothing to log
            logCommand = "PEXPIREAT";
            logArgs = [args[0], String(expirationTimes[args[0]])];
        }

        persistence
        .appendAof(logCommand, logArgs)
        .then(() => {})
        .catch(logger.error);
    }

    return result;
};


/* This function is used to parse a command from the received data. 
It uses the parseResp function to parse the RESP data and extract 
the command name and its arguments. The command name is converted 
to uppercase for consistency, and an object containing the command
and its arguments is returned. */
const parseCommand = (data) => {
    const [parts] = parseResp(data);
    const [name, ...args] = parts;   // Extract the command name and its arguments from the parsed parts
    return { command: name.toUpperCase(), args };
};

const init = () => {
    if (config.snapshot) {
        logger.info("Persistence mode: 'snapshot'");
        persistence.loadSnapshotSync();

        setInterval(async () => {
            await persistence.saveSnapshot();
        }, config.snapshotInterval);

    } else if (config.appendonly) {
        logger.info("Persistence mode: 'appendonly'");
        persistence.replayAofSync(executeCommand);

    } else {
        logger.info("Persistence mode: 'in-memory'");
    }
};

module.exports = { init, parseCommand, executeCommand };
