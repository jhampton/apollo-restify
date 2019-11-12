/**
 * Basic Restify test
 */

const restify = require('restify');
const { ApolloServer, HEALTH_CHECK_URL } = require('../../lib/');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { gql } = require('apollo-server-core');
const { createApolloFetch } = require('apollo-fetch');
const httpMocks = require('node-mocks-http');

const TEST_PORT = 8000;
const TEST_GRAPHQL_PATH = '/graphql';
const TEST_PLAYGROUND_PATH = '/graphql';

const typeDefs = gql(
    readFileSync(resolve(__dirname, './schema.graphql'), { encoding: 'utf8' })
);

let apolloServer;
let server;

describe('Apollo Restify integration', () => {
    beforeEach(() => {
        // Apollo Server
        apolloServer = new ApolloServer({
            // Configuration for the apollo server.
            // Options documented here: https://www.apollographql.com/docs/apollo-server/api/apollo-server#constructoroptions-apolloserver */
            typeDefs,
            playground: true,
            introspection: true,
            mockEntireSchema: true
        });
    });

    afterEach(() => {
        apolloServer = null;
    });

    // ApolloServer Sanity
    it('SANITY: Creates an Apollo Server', () => {
        expect(apolloServer).toBeInstanceOf(ApolloServer);
    });

    it("SMOKE: Apollo Server Calls 'Next' without error during normal operation", _callback => {
        const queryHandler = apolloServer.createGraphqlHandler();
        const data = {
            operationName: null,
            variables: {},
            query: '{me {name}}'
        };

        const testRequest = httpMocks.createRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: TEST_GRAPHQL_PATH,
            method: 'POST',
            body: data,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const testResponse = {
            sendRaw: jest.fn(),
            set: jest.fn()
        };
        // Data endpoint
        queryHandler(testRequest, testResponse, err => {
            expect(err).toBeUndefined();
            _callback();
        });
    });

    it.todo(
        "SMOKE: Apollo Server Calls 'Next' with error during non HttpQueryError happens"
    );

    it("SMOKE: Apollo Server Calls 'Next' without error during HttpQueryError happens", _callback => {
        const queryHandler = apolloServer.createGraphqlHandler();
        const data = {
            operationName: null,
            variables: {},
            query: '{invalid {query}}'
        };

        const testRequest = httpMocks.createRequest({
            method: 'POST',
            hostname: 'localhost',
            port: TEST_PORT,
            path: TEST_GRAPHQL_PATH,
            body: data,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const testResponse = {
            sendRaw: jest.fn(),
            status: jest.fn(),
            set: jest.fn()
        };
        // Data endpoint
        queryHandler(testRequest, testResponse, err => {
            expect(err).toBeUndefined();
            expect(testResponse.status).toBeCalledWith(400);
            expect(testResponse.set).toBeCalledWith({
                'Content-Type': 'application/json'
            });
            expect(testResponse.sendRaw).toBeCalled();
            _callback();
        });
    });

    describe('Restify Server', () => {
        beforeEach(_callback => {
            // Restify
            server = restify.createServer();
            server.use(restify.plugins.bodyParser());

            // Playground
            server.get(
                TEST_PLAYGROUND_PATH,
                apolloServer.createPlaygroundlHandler()
            );
            // Data endpoint:
            server.post(TEST_GRAPHQL_PATH, apolloServer.createGraphqlHandler());

            server.get(
                HEALTH_CHECK_URL,
                apolloServer.createHealthCheckHandler()
            );

            server.listen(TEST_PORT, _callback);
        });

        afterEach(_callback => {
            server.close(() => {
                server = null;
                return _callback();
            });
        });

        it('SANITY: Creates a restify server', () => {
            expect(server).toHaveProperty('get', 'post', 'listen');
        });

        it('SMOKE: Apollo Server returns expected mock data', async () => {
            const expectedData = {
                data: {
                    me: {
                        name: 'Hello World'
                    }
                }
            };
            const apolloFetch = createApolloFetch({
                uri: `http://localhost:${TEST_PORT}${TEST_GRAPHQL_PATH}`
            });
            const result = await apolloFetch({ query: '{me{name}}' });
            expect(result).toEqual(expectedData);
        });

        it('SMOKE: Apollo Server returns expected error', async () => {
            const expectedData = {
                errors: [
                    {
                        extensions: { code: 'GRAPHQL_VALIDATION_FAILED' },
                        locations: [{ column: 5, line: 1 }],
                        message: 'Cannot query field "invalid" on type "User".'
                    }
                ]
            };
            // Data endpoint
            const apolloFetch = createApolloFetch({
                uri: `http://localhost:${TEST_PORT}${TEST_GRAPHQL_PATH}`
            });
            const result = await apolloFetch({ query: '{me{invalid}}' });

            expect(result).toEqual(expectedData);
        });
    });
});
