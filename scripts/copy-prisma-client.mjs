/**
 * Copies the generated Prisma client into `dist/`.
 *
 * The client is generated to `src/infrastructure/prisma/generated/client` so
 * that `tsx` can resolve it in development, and tsconfig excludes it from the
 * TypeScript build (compiling several megabytes of generated code on every
 * build is pointless). That leaves the compiled output importing
 * `./generated/client` from a directory where it does not exist — so the
 * runtime files are copied across here.
 *
 * Node's fs rather than `cp -R` so the build works on Windows too.
 */
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const from = resolve("src/infrastructure/prisma/generated");
const to = resolve("dist/infrastructure/prisma/generated");

if (!existsSync(from)) {
    console.error(
        `Prisma client not found at ${from}.\nRun \`npm run prisma:generate\` before building.`,
    );
    process.exit(1);
}

cpSync(from, to, { recursive: true });
console.log(`Copied the Prisma client to ${to}`);
