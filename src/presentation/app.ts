import express, { type Application, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { config } from "../config";
import { logger } from "../shared/logger";
import { HttpStatus } from "../shared/http-status";
import { errorHandler, globalRateLimit, notFoundHandler, requestContext } from "./middleware";
import { buildRootRouter, type RootRouterDependencies } from "./routes";
import { mountDocs } from "./routes/docs.routes";

export const API_PREFIX = "/api/v1";

/**
 * Builds the Express application.
 *
 * The ORDER of this wiring is load-bearing:
 *   1. trust proxy      — before anything that reads req.ip
 *   2. requestContext   — opens the async-local store everything else reads
 *   3. helmet, cors     — reject before spending work on a request
 *   4. logging          — after the request id exists, so lines correlate
 *   5. body parsing     — with a size cap
 *   6. rate limiting    — after body parsing, because the auth limiter keys
 *                         on the submitted identifier
 *   7. health           — unauthenticated and unlimited, so a probe cannot be
 *                         rate-limited into reporting the service as down
 *   8. routes
 *   9. 404
 *  10. error handler    — must be last; Express identifies it by arity
 */
export function buildApp(deps: Omit<RootRouterDependencies, "features">): Application {
    const app = express();

    // Without this, req.ip behind a load balancer is the proxy's address, so
    // per-IP rate limiting silently limits the whole world as one client.
    // Only enable it when a proxy really is in front: otherwise a client can
    // spoof X-Forwarded-For and evade the limiter entirely.
    if (config.http.trustProxy) {
        app.set("trust proxy", 1);
    }
    app.disable("x-powered-by");

    app.use(requestContext());
    mountDocs(app);
    app.use(helmet());
    app.use(cors(buildCorsOptions()));

    app.use(
        pinoHttp({
            logger,
            // The request id is already on every line via the logger's mixin.
            genReqId: (req) => (req as Request).requestId,
            autoLogging: {
                ignore: (req) => (req as Request).url === "/health",
            },
        }),
    );

    // Capped: an uncapped JSON parser will happily buffer a 2GB body into
    // memory before any of your code runs.
    app.use(express.json({ limit: "1mb" }));
    app.use(express.urlencoded({ extended: true, limit: "1mb" }));

    app.use(globalRateLimit(config.http.rateLimit));

    app.get("/health", (_req: Request, res: Response) => {
        res.status(HttpStatus.OK).json({ status: "ok", uptime: process.uptime() });
    });

    app.use(
        API_PREFIX,
        buildRootRouter({
            ...deps,
            features: {
                branchesEnabled: config.features.branchesEnabled,
                multiTenant: config.tenancy.isMulti,
            },
        }),
    );

    app.use(notFoundHandler());
    app.use(errorHandler);

    return app;
}

function buildCorsOptions() {
    const origins = config.http.corsOrigins;

    if (origins.includes("*")) {
        // Config validation forbids this in production.
        return { origin: true, credentials: true };
    }

    return {
        origin: origins,
        credentials: true,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
        exposedHeaders: ["x-request-id"],
    };
}
