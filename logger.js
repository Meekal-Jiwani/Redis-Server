const debugNamespaces = (process.env.DEBUG || "*")
    .split(",")
    .map((ns) => ns.trim());

    const logger = (namespace) => {
        const log = (node, message) => {
            // Log message format with timestamp, namespace, and message!
            const logMessage = `${new Date().toISOString()} ${node} [${namespace}]: ${message}`;

            if (node === "error") {
                console.error(logMessage);
            }

            if (debugNamespaces.includes("*") || debugNamespaces.includes(namespace)) {
                console[node](logMessage);
                return;
            }
        };

        return {
            // 4 log levels:
            log: (message) => log("log", message),
            error: (message) => log("error", message),
            warn: (message) => log("warn", message),
            debug: (message) => log("debug", message),
        }
    };

    export default logger;
