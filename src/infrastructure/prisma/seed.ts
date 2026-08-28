/**
 * Idempotent bootstrap seed.
 *
 * Run it as many times as you like — every step checks before it writes. It is
 * safe on a fresh database, safe on a populated one, and safe in CI.
 *
 * What it guarantees exists:
 *   1. The reserved platform tenant (`__platform__`) that PlatformAdmin
 *      accounts live in.
 *   2. In single-tenant mode, the one tenant every request resolves to. This
 *      is what makes "tenantId is NOT NULL" work identically in both modes.
 *   3. Optionally, a first administrator, when BOOTSTRAP_ADMIN_* is set.
 */
import { config } from "../../config";
import { logger } from "../../shared/logger";
import { runCrossTenant } from "../../shared/request-context";
import { prisma, disconnectPrisma } from "./prisma.client";
import { BcryptPasswordHasher } from "../services";
import { UserEntity } from "../../domain/entities";
import { UserRole, UserType } from "../../domain/enums";
import { toUserCreateData } from "./mappers";

async function ensureTenant(slug: string, name: string, isSystem: boolean): Promise<string> {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
        logger.info({ slug, id: existing.id }, "Tenant already present");
        return existing.id;
    }

    const created = await prisma.tenant.create({ data: { slug, name, isSystem } });
    logger.info({ slug, id: created.id, isSystem }, "Tenant created");
    return created.id;
}

async function ensureAdmin(tenantId: string): Promise<void> {
    const { adminEmail, adminPassword, adminPhone } = config.bootstrap;

    if (!adminEmail || !adminPassword || !adminPhone) {
        logger.info(
            "BOOTSTRAP_ADMIN_EMAIL / _PASSWORD / _PHONE not all set — skipping admin creation",
        );
        return;
    }

    const email = adminEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        logger.info({ email }, "Bootstrap admin already present");
        return;
    }

    const hasher = new BcryptPasswordHasher(config.auth.bcryptCost);
    const user = UserEntity.create({
        tenantId,
        firstName: "Platform",
        lastName: "Administrator",
        email,
        phoneNumber: adminPhone,
        passwordHash: await hasher.hash(adminPassword),
        roles: [UserRole.PlatformAdmin, UserRole.TenantAdmin],
        userType: UserType.Employee,
        // The seeded password is in an env file and probably in shell history.
        // Forcing a change on first sign-in is the only thing that makes that
        // acceptable.
        mustChangePassword: true,
    });

    await prisma.user.create({ data: toUserCreateData(user) });
    logger.info(
        { email },
        "Bootstrap admin created — they must change the password on first login",
    );
}

async function main(): Promise<void> {
    // Seeding writes across tenants by definition; the extension would
    // otherwise refuse every one of these statements.
    await runCrossTenant(async () => {
        const systemTenantId = await ensureTenant(
            config.tenancy.systemTenantSlug,
            "Platform",
            true,
        );

        const primaryTenantId =
            config.tenancy.mode === "single"
                ? await ensureTenant(config.tenancy.defaultTenantSlug, "Default Workspace", false)
                : systemTenantId;

        // Platform admins belong to the system tenant in multi-tenant mode; in
        // single-tenant mode there is no meaningful distinction, so the
        // bootstrap admin lands in the one real workspace.
        await ensureAdmin(primaryTenantId);
    });
}

main()
    .then(() => logger.info("Seed complete"))
    .catch((error) => {
        logger.error({ err: error }, "Seed failed");
        process.exitCode = 1;
    })
    .finally(() => disconnectPrisma());
