import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Router, type Application } from "express";
import swaggerUi from "swagger-ui-express";
import { logger } from "../../shared/logger";

const OPENAPI_PATH = resolve(process.cwd(), "docs/openapi.json");

function loadOpenApiDocument(): Record<string, unknown> | null {
    if (!existsSync(OPENAPI_PATH)) {
        return null;
    }

    return JSON.parse(readFileSync(OPENAPI_PATH, "utf8")) as Record<string, unknown>;
}

/**
 * Serves Swagger UI at `/docs` from the generated OpenAPI spec.
 *
 * The spec is read once at boot from `docs/openapi.json` — regenerate it with
 * `npm run generate:openapi` after schema changes, then restart the server.
 *
 * Helmet's default CSP blocks Swagger UI's inline scripts, so `/docs` is
 * mounted before the global helmet middleware in `app.ts`.
 */
export function mountDocs(app: Application): void {
    const document = loadOpenApiDocument();
    if (!document) {
        logger.warn(
            "docs/openapi.json not found — /docs is not mounted. Run: npm run generate:openapi",
        );
        return;
    }

    const router = Router();

    router.get("/openapi.json", (_req, res) => {
        res.json(document);
    });

    router.use(swaggerUi.serve, swaggerUi.setup(document));

    app.use("/docs", router);
    logger.info("Swagger UI mounted at /docs");
}
