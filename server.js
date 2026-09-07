const net = require('net');

const server = net.createServer();
const port = 6379;
const host = '127.0.0.1';


server.on("connection", (socket) => {
    socket.on("data", (data) => {
        const reqData = data.toString();
        
        socket.write("res: " + reqData);
    });

    socket.on("end", () => {
        console.log("Client disconnected");
    });
});

server.listen(port, host, () => {
    console.log(`Server is running on ${host}:${port}`);
});
