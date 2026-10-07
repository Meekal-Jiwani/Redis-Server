const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const logger = require("./utils/logger.js")("persistence");

// Persistence class to handle saving and loading the datastore
class Persistence {
  DATA_FILE = path.join(__dirname, "data.rdb");

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
}

module.exports = new Persistence();
