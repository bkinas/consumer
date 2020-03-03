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

describe("Pact: Consumer Driven Contract", () => {
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
        });

        describe("and there no users in the database", () => {
            before(() =>
                provider.addInteraction({
                    state: "Has no users",
                    uponReceiving: "a request for a user with ID 101",
                    withRequest: {
                        method: "GET",
                        path: "/users/101",
                        headers: { Authorization: "Bearer token" },
                    },
                    willRespondWith: {
                        status: 404,
                    },
                })
            );

            it("returns a 404", done => {
                const user = getUserById(101)
                    .set(authHeader)
                    .then(res => res.body, () => null);

                expect(user)
                    .to.eventually.be.a("null")
                    .notify(done)
            })
        })

        describe("and the client is not authenticated", () => {
            before(() =>
                provider.addInteraction({
                    state: "is not authenticated",
                    uponReceiving: "a request for a user with ID 1",
                    withRequest: {
                        method: "GET",
                        path: "/users/1",
                    },
                    willRespondWith: {
                        status: 401,
                    },
                })
            );

            it("returns a 401 unauthorized", () => {
                return expect(getUserById(1)).to.eventually.be.rejectedWith(
                    "Unauthorized"
                )
            })
        })
    });

    // Write pact files
    after(() => {
        return provider.finalize()
    })
});
