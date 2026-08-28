import type { Application } from "express";
import type { Server } from "node:http";
import { logger } from "./shared/logger";

export function startServer(app: Application, port: number): Server {
    const server = app.listen(port, () => {
        logger.info({ port }, `API listening on http://localhost:${port}`);
    });

    // Node's default is 5s, which is shorter than most load balancers' 60s
    // idle timeout — the mismatch shows up as sporadic 502s when the balancer
    // reuses a connection the server has just closed.
    server.keepAliveTimeout = 65_000;
    server.headersTimeout = 66_000;

    return server;
}
