const buildRedisCommand = (input) => {
    const args = input.split(" ");
    let command = `*${args.length}\r\n`;

    args.forEach((arg) => {
        command += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
    });

    return command;
}

const encodeCommand = (parts) => {
    let out = `*${parts.length}\r\n`;
    for (const p of parts) out += `$${Buffer.byteLength(p)}\r\n${p}\r\n`;
    return out;
};

const parseResp = (buf) => {
    const commands = [];
    let pos = 0;

    const readLine = () => {
        const end = buf.indexOf("\r\n", pos);
        if (end === -1) throw new Error("incomplete data");   // prevents the infinite loop
        const line = buf.toString("utf8", pos, end);
        pos = end + 2;
        return line;
    };

    while (pos < buf.length) {
        try {
            const count = parseInt(readLine().slice(1), 10);
            const parts = [];

            for (let i = 0; i < count; i++) {
                const len = parseInt(readLine().slice(1), 10);
                parts.push(buf.toString("utf8", pos, pos + len));
                pos += len + 2;
            }

            commands.push(parts);
        } catch {
            break;
        }
    }

    return commands;
};

module.exports = { buildRedisCommand, encodeCommand, parseResp };