# apollo-restify

This is a implementation of Apollo Server 2 as Restify middleware.

## Installing (Pending publish)

For now, clone/download this repository and `import { ApolloServer } from 'LOCATION-OF-REPO'`

*PENDING PUBLISH*

```bash
npm install @apollo/restify
```

## Example

See the `example` directory for a runnable example.  Use `node index.js` to run.

## Using

```js
import restify from 'restify';
import { ApolloServer } from 'apollo-restify';

const server = restify.createServer();

const apolloServer = new ApolloServer({
  // Configuration for the apollo server.
  // Options documented here: https://www.apollographql.com/docs/apollo-server/api/apollo-server#constructoroptions-apolloserver */
});

// Playground:
server.get('/graphql', apolloServer.createHandler());
// Data endpoint:
server.post('/graphql', apolloServer.createHandler());
```

### Adding the Healthcheck Endpoint

```js
import { HEALTH_CHECK_URL } from 'apollo-restify';
server.get(HEALTH_CHECK_URL, apolloServer.createHealthCheckHandler());
```
## Building and Tests

Use `npm run watch` to watch files and compile from TS -> JS.

There are basic sanity and smoke tests written in Jest.  Use `npm run test` to run tests in CI or use `npm run test:watch` to auto-run tests on change.
