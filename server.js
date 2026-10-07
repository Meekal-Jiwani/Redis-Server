const net = require("net");

const logger = require("./logger").default("server");

const server = net.createServer();
const port = 6379;
const host = '127.0.0.1';


server.on("connection", (socket) => {
    console.log("Client Connected");

    socket.on("data", (data) => {
        let response;
        
        try {
            const { command, args } = parseCommand(data);
            response = executeCommand(command, args);
        } 
        catch (err) {
            logger.error(err);
            response = `-ERR unknown command '${command}'\r\n`;
        }

        socket.write(response);
    });

    socket.on("end", () => {
        console.log("Client Disconnected");
    });
});

server.listen(port, host, () => {
    logger.log(`Server is running on ${host}:${port}`);
});
