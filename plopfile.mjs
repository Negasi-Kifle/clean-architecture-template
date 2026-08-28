/**
 * Module generator.
 *
 * `npm run generate:module` scaffolds a complete vertical slice across all
 * four layers plus its composition module, and prints the two lines you must
 * add by hand to wire it in.
 *
 * The point is not typing speed. It is that a new domain lands with the same
 * structure, the same tenant scoping, the same validation and the same error
 * handling as every other one — so the architecture stays uniform under
 * deadline pressure, which is exactly when it usually stops being uniform.
 */
export default function (plop) {
    plop.setGenerator("module", {
        description: "Scaffold a domain module across every layer",
        prompts: [
            {
                type: "input",
                name: "name",
                message: "Singular domain name (e.g. product, invoice, order):",
                validate: (value) =>
                    /^[a-z][a-zA-Z0-9-]*$/.test(value.trim()) ||
                    "Use a lowercase singular name, e.g. product or purchase-order",
            },
        ],
        actions: [
            {
                type: "add",
                path: "src/domain/entities/{{kebabCase name}}.entity.ts",
                templateFile: "plop-templates/entity.hbs",
            },
            {
                type: "add",
                path: "src/domain/repositories/{{kebabCase name}}.repository.interface.ts",
                templateFile: "plop-templates/repository.interface.hbs",
            },
            {
                type: "add",
                path: "src/application/use-cases/{{camelCase name}}s/{{kebabCase name}}.usecases.ts",
                templateFile: "plop-templates/usecases.hbs",
            },
            {
                type: "add",
                path: "src/infrastructure/prisma/where-clauses/{{kebabCase name}}.where.ts",
                templateFile: "plop-templates/where.hbs",
            },
            {
                type: "add",
                path: "src/infrastructure/prisma/mappers/{{kebabCase name}}.mapper.ts",
                templateFile: "plop-templates/mapper.hbs",
            },
            {
                type: "add",
                path: "src/infrastructure/prisma/repositories/{{kebabCase name}}.repository.ts",
                templateFile: "plop-templates/repository.hbs",
            },
            {
                type: "add",
                path: "src/presentation/DTOs/request/{{camelCase name}}s/{{kebabCase name}}.dto.ts",
                templateFile: "plop-templates/dto.hbs",
            },
            {
                type: "add",
                path: "src/presentation/DTOs/response/{{kebabCase name}}.response.ts",
                templateFile: "plop-templates/response.hbs",
            },
            {
                type: "add",
                path: "src/presentation/controllers/{{kebabCase name}}.controller.ts",
                templateFile: "plop-templates/controller.hbs",
            },
            {
                type: "add",
                path: "src/presentation/routes/{{kebabCase name}}.routes.ts",
                templateFile: "plop-templates/routes.hbs",
            },
            {
                type: "add",
                path: "src/composition/{{kebabCase name}}.module.ts",
                templateFile: "plop-templates/module.hbs",
            },
            () =>
                [
                    "",
                    "Generated. Four steps left, all deliberate:",
                    "",
                    "  1. Add the model to src/infrastructure/prisma/schema.prisma.",
                    "     It MUST have `tenantId String @db.Uuid` and a Tenant relation,",
                    "     then add its name to TENANT_SCOPED_MODELS in prisma.client.ts",
                    "     (the guard test in tenant-isolation.int.spec.ts checks this).",
                    "  2. npx prisma migrate dev --name add_<name>",
                    "  3. Export the new files from the index.ts in each folder you touched.",
                    "  4. Wire it up: add the controller to RouteControllers and mount the",
                    "     router in src/presentation/routes/index.ts, and build the module",
                    "     in src/composition/composition-root.ts.",
                    "",
                ].join("\n"),
        ],
    });
}
