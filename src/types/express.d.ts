import type { AuthenticatedPrincipal } from "../domain/interfaces";

declare global {
    namespace Express {
        interface Request {
            /**
             * Set by `authenticate`. Built exclusively from verified JWT claims —
             * never from a header, query parameter or body field, so a client
             * cannot change who they are or which tenant they are in.
             */
            principal?: AuthenticatedPrincipal;
            /** Set by `requestContext`. Echoed back as the `x-request-id` header. */
            requestId: string;
        }

        interface Locals {
            /** Parsed and coerced request body, set by `validateBody`. */
            body?: unknown;
            /** Parsed and coerced query string, set by `validateQuery`. */
            query?: unknown;
            /** Parsed and coerced route params, set by `validateParams`. */
            params?: unknown;
        }
    }
}

export {};
