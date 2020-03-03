const path = require("path");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;
const { Pact, Matchers } = require("@pact-foundation/pact");
const LOG_LEVEL = process.env.LOG_LEVEL || "WARN";

chai.use(chaiAsPromised);

const authHeader = {
    Authorization: "Bearer token",
};

describe("Pact", () => {
    const provider = new Pact({
        consumer: "Consumer Service",
        provider: "Provider Service",
        // port: 1234, // You can set the port explicitly here or dynamically (see setup() below)
        log: path.resolve(process.cwd(), "logs", "mockserver-integration.log"),
        dir: path.resolve(process.cwd(), "pacts"),
        logLevel: LOG_LEVEL,
        spec: 2,
    });

    // Alias flexible matchers for simplicity
    const { like, term, iso8601Date } = Matchers;

    // Define user payload, with flexible matchers
    //
    // This makes the test much more resilient to changes in actual data.
    // Here we specify the 'shape' of the object that we care about.
    // It is also import here to not put in expectations for parts of the
    // API we don't care about
    const userBodyExpectation = {
        id: like(1),
        name: like("Jan Kowalski"),
        birth: iso8601Date(),
    };

    // Setup a Mock Server before unit tests run.
    // This server acts as a Test Double for the real Provider API.
    // We then call addInteraction() for each test to configure the Mock Service
    // to act like the Provider
    // It also sets up expectations for what requests are to come, and will fail
    // if the calls are not seen.
    before(() =>
        provider.setup().then(opts => {
            // Get a dynamic port from the runtime
            process.env.API_HOST = `http://localhost:${opts.port}`
        })
    );

    // After each individual test (one or more interactions)
    // we validate that the correct request came through.
    // This ensures what we _expect_ from the provider, is actually
    // what we've asked for (and is what gets captured in the contract)
    afterEach(() => provider.verify());

    // Configure and import consumer API
    // Note that we update the API endpoint to point at the Mock Service
    const { getUserById } = require("../src/consumer");

    // Verify service client works as expected.
    //
    // Note that we don't call the consumer API endpoints directly, but
    // use unit-style tests that test the collaborating function behaviour -
    // we want to test the function that is calling the external service.

    describe("when a call to the User Service is made to retreive a single user by ID", () => {
        describe("and there is a user with ID 1", () => {
            before(() =>
                provider.addInteraction({
                    state: "Has a user with ID 1",
                    uponReceiving: "a request for a user with ID 1",
                    withRequest: {
                        method: "GET",
                        path: term({ generate: "/users/1", matcher: "/users/[0-9]+" }),
                        headers: authHeader,
                    },
                    willRespondWith: {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json; charset=utf-8",
                        },
                        body: userBodyExpectation,
                    },
                })
            );

            it("returns the user", done => {
                const data = getUserById(1)
                    .set(authHeader)
                    .then(res => res.body, () => null);

                expect(data)
                    .to.eventually.have.deep.property("id", 1)
                    .notify(done)
            })
        })
    });

    // Write pact files
    after(() => {
        return provider.finalize()
    })
});
