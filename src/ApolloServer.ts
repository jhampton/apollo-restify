import {
    RenderPageOptions,
    renderPlaygroundPage
} from '@apollographql/graphql-playground-html';
import {
    ApolloServerBase,
    convertNodeHttpToRequest,
    GraphQLOptions,
    HttpQueryError,
    runHttpQuery,
    Config
} from 'apollo-server-core';

// tslint:disable-next-line no-implicit-dependencies
import { Request, Response } from 'restify';

export type OnHealthCheck = (req: Request) => Promise<any>;

export const HEALTH_CHECK_URL = '/.well-known/apollo/server-health';

export class ApolloServer extends ApolloServerBase {

    // Extract Apollo Server options from the request.
    public async createGraphQLServerOptions(
        req: Request,
        res: Response
    ): Promise<GraphQLOptions> {
        return super.graphQLServerOptions({ req, res });
    }

    // Handle incoming GraphQL requests using Apollo Server.
    public createGraphqlHandler() {
        const willStartPromise =  this.willStart();

        return restifyAsyncAwaitWrapper(async (req: Request, res: Response) => {
            const didWillStart = await willStartPromise;
            const options = await this.createGraphQLServerOptions(req, res);
            const { responseInit, graphqlResponse } = await runHttpQuery(
                [req, res],
                {
                    method: req.method!,
                    options,
                    query: req.body,
                    request: convertNodeHttpToRequest(req)
                }
            );

            // Use raw here because Apollo returns response as a string.
            res.sendRaw(graphqlResponse, responseInit.headers);
        });
    }

    // Handle incoming GraphQL Playground requests.
    public createPlaygroundlHandler() {
        return (req: Request, res: Response, next: (err?: Error) => void) => {
            const middlewareOptions: RenderPageOptions = {
                endpoint: this.graphqlPath,
                subscriptionEndpoint: this.subscriptionsPath,
                version: '1',
                ...this.playgroundOptions
            };
            const playgroundHTML = renderPlaygroundPage(middlewareOptions);
            res.header('Content-Type', 'text/html');

            // Use raw here because Playground returns HTML as a string.
            res.sendRaw(playgroundHTML);
            return next();
        };
    }

    // Handle incoming healthcheck requests.
    public createHealthCheckHandler({
        onHealthCheck
    }: { onHealthCheck?: OnHealthCheck } = {}) {
        return restifyAsyncAwaitWrapper(async (req: Request, res: Response) => {
            if (onHealthCheck) {
                try {
                    await onHealthCheck(req);
                } catch (error) {
                    res.send(503, { status: 'fail' });
                    return;
                }
            }

            // Response follows
            // https://tools.ietf.org/html/draft-inadarei-api-health-check-01
            res.header('Content-Type', 'application/health+json');
            res.json({ status: 'pass' });
        });
    }
    // This integration does not support file uploads.
    protected supportsUploads(): boolean {
        return false;
    }

    // This integration supports subscriptions.
    protected supportsSubscriptions(): boolean {
        return true;
    }
}

// Turns restify handler to async-await handler.
function restifyAsyncAwaitWrapper(handler: (req: Request, res: Response) => void) {
    return (req: Request, res: Response, next: (err?: Error) => void) => {
        (async () => {
            await handler(req, res);
            return next();
        })().catch((err: HttpQueryError) => {
            // Let Resitfy handle non GraphQL errors.
            if (err.name !== 'HttpQueryError') {
                return next(err);
            }

            // HttpQueryError
            if (err.headers) {
                res.set(err.headers);
            }
            if (err.statusCode) {
                res.status(err.statusCode);
            }

            // Use raw here because Apollo returns error message as a string.
            res.sendRaw(err.message);
            return next();
        });
    };
}
