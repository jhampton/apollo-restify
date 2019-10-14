const restify = require('restify');
const { ApolloServer, HEALTH_CHECK_URL } = require('../lib/');

const server = restify.createServer();

const apolloServer = new ApolloServer({
  // Configuration for the apollo server.
  // Options documented here: https://www.apollographql.com/docs/apollo-server/api/apollo-server#constructoroptions-apolloserver */
});

// Playground:
server.get('/graphql', apolloServer.createHandler());
// Data endpoint:
server.post('/graphql', apolloServer.createHandler());

server.get(HEALTH_CHECK_URL, apolloServer.createHealthCheckHandler());

server.listen({port: process.env.PORT || 4000});
