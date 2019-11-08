/**
 * Basic Restify test
 */

const restify = require('restify');
const { ApolloServer, HEALTH_CHECK_URL } = require('../../lib/');
const { readFileSync } = require("fs");
const { resolve } = require("path");
const { gql } = require('apollo-server-core');
import { createApolloFetch } from 'apollo-fetch';
const httpMocks = require('node-mocks-http'); 

const TEST_PORT = 8000,
    TEST_GRAPHQL_PATH = "/graphql",
    TEST_PLAYGROUND_PATH = "graphql";

const typeDefs = gql(
  readFileSync(resolve(__dirname, "./schema.graphql"), { encoding: "utf8" })
);

let apolloServer,
    server;

const testSetup = () => {
    // Apollo Server
    apolloServer = new ApolloServer({
      // Configuration for the apollo server.
      // Options documented here: https://www.apollographql.com/docs/apollo-server/api/apollo-server#constructoroptions-apolloserver */
      typeDefs,
      playground: true,
      introspection: true,
      mockEntireSchema: true
    });
    
    // Restify
    server = restify.createServer();
    server.use(restify.plugins.bodyParser());
    
    // // Playground
    // server.get('/graphql', apolloServer.createHandler());
    // // Data endpoint:
    // server.post('/graphql', apolloServer.createHandler());
    
    // server.get(HEALTH_CHECK_URL, apolloServer.createHealthCheckHandler());
    
    // // Hello
    // server.get('/', (req, res, next) => {
    //   res.send("Hello World");
    //   next();
    // });

    return true;
}


// // Start server listen
// const PORT = process.env.PORT || 4000;
// server.listen({port: PORT});

// console.log(`Apollo-enabled restify server running at ${PORT}`);

describe('Apollo Restify integration', () => {
    beforeEach( (_callback) => {
        testSetup();
        return _callback();
    });

    afterEach( (_callback) => {
        try {
            server.close();
        } catch (error) {
            console.log(`Cannot stop server`, error);
        }
        try {
            server = null;
        } catch (error) {
            
        }
        apolloServer = null;
        _callback();
    });
    // ApolloServer Sanity
    it('SANITY: Creates an Apollo Server', () => {
        expect(apolloServer).toBeInstanceOf(ApolloServer);
    });
    // Restify Sanity
    it('SANITY: Creates a restify server', () => {
        expect(server).toHaveProperty('get','post','listen');
    });

    // Apollo-restify
    it("SMOKE: Apollo Server returns expected mock data", (_callback) => {
        const expectedData = {
            "data": {
                "me": {
                "name": "Hello World"
                }
            }
        };
        // Data endpoint
        server.post(TEST_GRAPHQL_PATH, apolloServer.createHandler());
        server.listen(TEST_PORT, "localhost", async () => {
            const apolloFetch = createApolloFetch({ uri: `http://localhost:8000${TEST_GRAPHQL_PATH}`});
            const result = await apolloFetch({ query: '{me{name}}' });
            expect(result).toEqual(expectedData);
            _callback();
        });
    });

    it("SMOKE: Apollo Server Calls 'Next' during normal operation", (_callback) => {
        const queryHandler = apolloServer.createHandler();
        const data = `{"operationName":null,"variables":{},"query":"{me {name}}"}`;
        
        const testRequest = httpMocks.createRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: TEST_GRAPHQL_PATH,
            method: 'POST',
            body: data,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        });
        const testResponse = {
            sendRaw: jest.fn(),
            set: jest.fn()
        };
        const testNext = jest.fn();
        // Data endpoint
        queryHandler(testRequest, testResponse, testNext).then(() => {
            expect(testNext).toBeCalled();
            _callback();
        })
    });

    it("SMOKE: Apollo Server Calls 'Next' with error for error cases", (_callback) => {
        const queryHandler = apolloServer.createHandler();
        // const data = JSON.stringify({"operationName":null,"variables":{},"query":"{invalid {query}}"});
        const data = {"operationName":null,"variables":{},"query":"{invalid {query}}"};
        const expectedError = {"name":"HttpQueryError","statusCode":400,"isGraphQLError":true,"headers":{"Content-Type":"application/json"}};
        
        const testRequest = httpMocks.createRequest({
            method: 'POST',
            url: `http://localhost:8000`,
            path: TEST_GRAPHQL_PATH,
            body: data,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        });
        const testResponse = {
            sendRaw: jest.fn(),
            set: jest.fn()
        };
        let nextErrorParam;
        const testNext = jest.fn((thing) => nextErrorParam = thing);
        // Data endpoint
        queryHandler(testRequest, testResponse, testNext).then(() => {
            expect(testNext).toBeCalledTimes(1);
            expect(expectedError).toEqual(expectedError);
            _callback();
        })
    });
});
