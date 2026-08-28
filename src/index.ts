import type { Server } from "node:http";
import { config } from "./config";
import { logger } from "./shared/logger";
import { connectPrisma, disconnectPrisma } from "./infrastructure/prisma/prisma.client";
import { buildContainer } from "./composition";
import { buildApp } from "./presentation/app";
import { startServer } from "./server";

/**
 * Process entry point.
 *
 * Importing `./config` validates the entire environment before anything else
 * runs, so a missing or malformed variable stops the process at boot with a
 * precise message rather than surfacing as a null three layers deep later.
 */
async function bootstrap(): Promise<void> {
    logger.info(
        {
            nodeEnv: config.nodeEnv,
            tenancyMode: config.tenancy.mode,
            branchesEnabled: config.features.branchesEnabled,
        },
        "Starting API",
    );

    await connectPrisma();

    const container = buildContainer();
    const app = buildApp(container);
    const server = startServer(app, config.port);

    registerShutdownHandlers(server);
}

/**
 * Graceful shutdown.
 *
 * Stop accepting connections, let in-flight requests finish, then close the
 * database pool. Exiting immediately on SIGTERM — which is what an orchestrator
 * sends on every deploy — aborts requests that were mid-flight and leaks
 * connections on the database side.
 */
function registerShutdownHandlers(server: Server): void {
    let shuttingDown = false;

    const shutdown = (signal: NodeJS.Signals): void => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.info({ signal }, "Shutting down");

        // Backstop: if a long-lived connection refuses to drain, exit anyway
        // rather than hanging until the orchestrator SIGKILLs us.
        const forceExit = setTimeout(() => {
            logger.error("Shutdown timed out after 15s — forcing exit");
            process.exit(1);
        }, 15_000);
        forceExit.unref();

        server.close(async (closeError) => {
            if (closeError) logger.error({ err: closeError }, "Error closing HTTP server");
            try {
                await disconnectPrisma();
            } catch (error) {
                logger.error({ err: error }, "Error disconnecting from the database");
                process.exit(1);
            }
            logger.info("Shutdown complete");
            process.exit(closeError ? 1 : 0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // An unhandled rejection leaves the process in an unknown state. Log it
    // and let the orchestrator restart into a known-good one.
    process.on("unhandledRejection", (reason) => {
        logger.fatal({ err: reason }, "Unhandled promise rejection");
        process.exit(1);
    });

    process.on("uncaughtException", (error) => {
        logger.fatal({ err: error }, "Uncaught exception");
        process.exit(1);
    });
}

bootstrap().catch((error) => {
    logger.fatal({ err: error }, "Failed to start");
    process.exit(1);
});
