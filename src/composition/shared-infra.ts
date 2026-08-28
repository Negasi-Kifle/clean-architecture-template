import { config } from "../config";
import type {
    IEmailSender,
    IPasswordHasher,
    ISecureRandom,
    ITokenService,
} from "../domain/services";
import type {
    IIdentityRepository,
    IPasswordResetTokenRepository,
    ISessionRepository,
    IUnitOfWork,
} from "../domain/repositories";
import {
    BcryptPasswordHasher,
    JoseTokenService,
    LoggingEmailSender,
    NodeSecureRandom,
    NodemailerEmailSender,
} from "../infrastructure/services";
import {
    IdentityRepository,
    PasswordResetTokenRepository,
    SessionRepository,
} from "../infrastructure/prisma/repositories";
import { PrismaUnitOfWork } from "../infrastructure/prisma/unit-of-work";
import { prisma } from "../infrastructure/prisma/prisma.client";

/**
 * Adapters used by more than one domain module.
 *
 * An adapter needed by exactly one module is built inside that module instead.
 * The rule keeps this file from becoming a service locator that every module
 * reaches into for whatever it happens to want.
 */
export interface SharedInfra {
    readonly passwordHasher: IPasswordHasher;
    readonly tokenService: ITokenService;
    readonly secureRandom: ISecureRandom;
    readonly emailSender: IEmailSender;
    readonly identityRepository: IIdentityRepository;
    readonly sessionRepository: ISessionRepository;
    readonly passwordResetTokenRepository: IPasswordResetTokenRepository;
    readonly unitOfWork: IUnitOfWork;
}

export function buildSharedInfra(): SharedInfra {
    return {
        passwordHasher: new BcryptPasswordHasher(config.auth.bcryptCost),
        tokenService: new JoseTokenService({
            secret: config.auth.jwtSecret,
            issuer: config.auth.issuer,
            audience: config.auth.audience,
            defaultTtlSeconds: config.auth.accessTokenTtlSeconds,
        }),
        secureRandom: new NodeSecureRandom(),
        // No SMTP configured is a supported state, not an error: local
        // development and CI get a working reset flow with the link logged.
        emailSender: config.mail.enabled
            ? new NodemailerEmailSender({
                  host: config.mail.host!,
                  port: config.mail.port,
                  secure: config.mail.secure,
                  user: config.mail.user,
                  password: config.mail.password,
                  from: config.mail.from,
                  fromName: config.mail.fromName,
              })
            : new LoggingEmailSender(),

        identityRepository: new IdentityRepository(prisma),
        sessionRepository: new SessionRepository(prisma),
        passwordResetTokenRepository: new PasswordResetTokenRepository(prisma),
        unitOfWork: new PrismaUnitOfWork(),
    };
}
