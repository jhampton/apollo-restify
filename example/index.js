const restify = require('restify');
const { ApolloServer, HEALTH_CHECK_URL } = require('../lib/');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { gql } = require('apollo-server-core');

const typeDefs = gql(
    readFileSync(resolve(__dirname, './schema.graphql'), { encoding: 'utf8' })
);

// Apollo Server
const apolloServer = new ApolloServer({
    // Configuration for the apollo server.
    // Options documented here: https://www.apollographql.com/docs/apollo-server/api/apollo-server#constructoroptions-apolloserver */
    typeDefs,
    playground: true,
    introspection: true,
    debug: true,
    mockEntireSchema: true
});

// Restify
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Playground
server.get(
    '/graphql',
    restify.plugins.conditionalHandler([
        {
            contentType: 'text/html',
            handler: apolloServer.createPlaygroundlHandler()
        },
        {
            contentType: 'application/json',
            handler: apolloServer.createGraphqlHandler()
        }
    ])
);

// Data endpoint:
server.post('/graphql', apolloServer.createGraphqlHandler());

server.get(HEALTH_CHECK_URL, apolloServer.createHealthCheckHandler());

// Hello
server.get('/', (req, res, next) => {
    res.send('Hello World');
    next();
});

// Start server listen
const PORT = process.env.PORT || 4000;
server.listen({ port: PORT });

console.log(`Apollo-enabled restify server running at ${PORT}`);
