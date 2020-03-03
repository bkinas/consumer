const pact = require("@pact-foundation/pact-node");
const path = require("path");
const opts = {
    pactFilesOrDirs: [
        path.resolve(
            __dirname,
            "../pacts/consumer_service-provider_service.json"
        ),
    ],
    pactBroker: "http://localhost",
    tags: ["dev"],
    consumerVersion: "1.1.0"
};

pact
    .publishPacts(opts)
    .then(() => {
        console.log("Pact contract publishing complete!");
        console.log("");
        console.log("Head over to http://localhost");
        console.log("to see your published contracts.")
    })
    .catch(e => {
        console.log("Pact contract publishing failed: ", e)
    });
