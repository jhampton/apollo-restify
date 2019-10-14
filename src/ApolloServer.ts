import { ApolloServerBase, GraphQLOptions, HttpQueryError } from 'apollo-server-core';
import { Request, Response } from 'restify';
import { renderPlaygroundPage, RenderPageOptions } from '@apollographql/graphql-playground-html';
import { parseAll } from 'accept';

import { graphqlRestify } from './restifyApollo';

export type OnHealthCheck = (req: Request) => Promise<any>;
export type OnError = (req: Request, res: Response, status: number, error?: Error) => any;

export interface ServerRegistration {
    path?: string;
}

export const HEALTH_CHECK_URL = '/.well-known/apollo/server-health';

// Interface for Restify middleware
interface RestifyHandler {
    req: Request;
    res: Response;
    next: Function;
}

export class ApolloServer extends ApolloServerBase {
    // This integration does not support file uploads.
    protected supportsUploads(): boolean {
        return false;
    }

    // This integration supports subscriptions.
    protected supportsSubscriptions(): boolean {
        return true;
    }

    // Extract Apollo Server options from the request.
    async createGraphQLServerOptions(req: Request, res: Response): Promise<GraphQLOptions> {
        return super.graphQLServerOptions({ req, res });
    }

    // Prepares and returns an async function that can be used by Micro to handle
    // GraphQL requests.
    public createHandler({ path }: ServerRegistration = {}) {
        // We'll kick off the `willStart` right away, so hopefully it'll finish
        // before the first request comes in.
        const promiseWillStart = this.willStart();

        return async (req: Request, res: Response, next: Function) => {
            this.graphqlPath = path || '/graphql';

            await promiseWillStart;

            if (!this.handleGraphqlRequestsWithPlayground({ req, res, next })) {
                await this.handleGraphqlRequestsWithServer({ req, res, next });
            }
        };
    }

    createHealthCheckHandler({ onHealthCheck }: { onHealthCheck?: OnHealthCheck } = {}) {
        return async (req: Request, res: Response, next: Function) => {
            // Response follows
            // https://tools.ietf.org/html/draft-inadarei-api-health-check-01
            res.header('Content-Type', 'application/health+json');

            if (onHealthCheck) {
                try {
                    await onHealthCheck(req);
                } catch (error) {
                    res.send(503, { status: 'fail' });
                    return;
                }
            }

            res.send(200, { status: 'pass' });
        };
    }

    // If the `playgroundOptions` are set, register a `graphql-playground` instance
    // (not available in production) that is then used to handle all
    // incoming GraphQL requests.
    private handleGraphqlRequestsWithPlayground({
        req,
        res,
        next
    }: RestifyHandler): boolean {
        let handled = false;

        if (this.playgroundOptions && req.method === 'GET') {
            const accept = parseAll(req.headers);
            const types = accept.mediaTypes as string[];
            const prefersHTML =
                types.find((x: string) => x === 'text/html' || x === 'application/json') ===
                'text/html';

            if (prefersHTML) {
                const middlewareOptions:RenderPageOptions = {
                    version: "1",
                    endpoint: this.graphqlPath,
                    subscriptionEndpoint: this.subscriptionsPath,
                    ...this.playgroundOptions
                };
                res.send(200, renderPlaygroundPage(middlewareOptions), {
                    'Content-Type': 'text/html'
                });
                return next();
            }
        }

        return next();
    }

    // Handle incoming GraphQL requests using Apollo Server.
    private async handleGraphqlRequestsWithServer({
        req,
        res,
        next,
    }: RestifyHandler): Promise<void> {
        const graphqlHandler = graphqlRestify(() => {
            return this.createGraphQLServerOptions(req, res);
        });

        try {
            const { responseInit, graphqlResponse } = await graphqlHandler(req, res);
            res.send(200, graphqlResponse, responseInit.headers);
            return next();
        } catch (error) {
            // Per the Restify documentation, errors will be set on the response
            // and the HttpQueryError will be passed to `next`.
            if ('HttpQueryError' === error.name && error.headers) {
                res.set(error.headers);
            }
            res.send(error.statusCode || 500, error.message);
            next(error);
        }
    }
}
