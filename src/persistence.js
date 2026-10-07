const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const logger = require("./utils/logger.js")("persistence");
const config = require("./config.json");

// Persistence class to handle saving and loading the datastore
class Persistence {
  DATA_FILE = path.join(__dirname, "data.rdb");
  AOF_FILE = path.join(__dirname, "data.aof");

  constructor() {
    this.store = {};
    this.expirationTimes = {};
  }

  // Save the snapshot to the data file asynchronously
  async saveSnapshot() {
    const data = JSON.stringify({
      store: this.store,
      expirationTimes: this.expirationTimes,
    });

    // Write the data to the file!
    try {
      await fsp.writeFile(this.DATA_FILE, data);
      logger.info(`Saved datastore to file: ${this.DATA_FILE}`);
    } catch (error) {
      logger.error(`Failed to save datastore: ${error.message}`);
    }
  }

  // Load the snapshot from the data file synchronously during server startup
  loadSnapshotSync() {
    if (!fs.existsSync(this.DATA_FILE)) return;

    try {
      const data = fs.readFileSync(this.DATA_FILE).toString();

      // Parse the data and load it into the store and expirationTimes
      if (data) {
        const { store: loadedStore, expirationTimes: loadedExpirationTimes } =
          JSON.parse(data);

        // Merge the loaded data into the current store and expirationTimes
        Object.assign(this.store, loadedStore);
        Object.assign(this.expirationTimes, loadedExpirationTimes);

        logger.info("Datastore loaded successfully");
      }
    } catch (error) {
      logger.error(`Failed to load datastore: ${error.message}`);
    }
  }

  // Append commands to the AOF file asynchronously
  async appendAof(command, args) {
    let aofLog = `${command} ${args.join(" ")}\r\n`;

    try {
      await fsp.appendFile(this.AOF_FILE, aofLog);
      logger.info(`Appended to AOF file: ${aofLog.trim()}`);
    } catch (error) {
      logger.error(`Failed to append to AOF file: ${error.message}`);
    }
  }

  // Replay the AOF file synchronously during server startup
  replayAofSync(executeCommand) {
    if (!config.appendonly || !fs.existsSync(this.AOF_FILE)) {
      return;
    }

    // Read the AOF file and execute each command to restore the state
    try {
      const data = fs.readFileSync(this.AOF_FILE).toString();

      if (!data) {
        return;
      }

      const logs = data.split("\r\n").filter(Boolean);

      logger.info("Replay AOF started");

      // Execute each command in the AOF log to restore the state
      for (const logEntry of logs) {
        const [command, ...args] = logEntry.split(" ");
        executeCommand(command, args, true);
      }

      logger.info("Replay AOF successfully completed");
    } catch (error) {
      logger.error(`Failed to replay AOF: ${error.message}`);
    }
  }
}

module.exports = new Persistence();
