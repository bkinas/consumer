const { server } = require("./consumer.js");

const PORT = 8080;

server.listen(PORT, () => {
    console.log(`User Age Service listening on http://localhost:${PORT}`)
});
