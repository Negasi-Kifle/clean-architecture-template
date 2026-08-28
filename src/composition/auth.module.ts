import { config } from "../config";
import {
    ChangePasswordUseCase,
    ListSessionsUseCase,
    LoginUseCase,
    LogoutAllUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    VerifyResetTokenUseCase,
} from "../application/use-cases/auth";
import { GetUserUseCase } from "../application/use-cases/users";
import { AuthController } from "../presentation/controllers";
import { TenantRepository, UserRepository } from "../infrastructure/prisma/repositories";
import { prisma } from "../infrastructure/prisma/prisma.client";
import type { SharedInfra } from "./shared-infra";

export interface AuthModule {
    controller: AuthController;
}

export function buildAuthModule(infra: SharedInfra): AuthModule {
    const userRepository = new UserRepository(prisma);
    const tenantRepository = new TenantRepository(prisma);

    const loginUseCase = new LoginUseCase({
        identityRepository: infra.identityRepository,
        tenantRepository,
        sessionRepository: infra.sessionRepository,
        userRepository,
        passwordHasher: infra.passwordHasher,
        tokenService: infra.tokenService,
        secureRandom: infra.secureRandom,
        accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds,
    });

    const refreshTokenUseCase = new RefreshTokenUseCase({
        sessionRepository: infra.sessionRepository,
        identityRepository: infra.identityRepository,
        tokenService: infra.tokenService,
        secureRandom: infra.secureRandom,
        unitOfWork: infra.unitOfWork,
        accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
        refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds,
    });

    const controller = new AuthController(
        loginUseCase,
        refreshTokenUseCase,
        new LogoutUseCase(infra.sessionRepository, infra.secureRandom),
        new LogoutAllUseCase(infra.sessionRepository),
        new ChangePasswordUseCase({
            passwordHasher: infra.passwordHasher,
            sessionRepository: infra.sessionRepository,
            unitOfWork: infra.unitOfWork,
            passwordMinLength: config.auth.passwordMinLength,
        }),
        new RequestPasswordResetUseCase({
            identityRepository: infra.identityRepository,
            passwordResetTokenRepository: infra.passwordResetTokenRepository,
            secureRandom: infra.secureRandom,
            emailSender: infra.emailSender,
            clientUrl: config.clientUrl,
            ttlSeconds: config.auth.passwordResetTtlSeconds,
        }),
        new ResetPasswordUseCase({
            passwordResetTokenRepository: infra.passwordResetTokenRepository,
            passwordHasher: infra.passwordHasher,
            secureRandom: infra.secureRandom,
            unitOfWork: infra.unitOfWork,
            passwordMinLength: config.auth.passwordMinLength,
        }),
        new VerifyResetTokenUseCase(infra.passwordResetTokenRepository, infra.secureRandom),
        new ListSessionsUseCase(infra.sessionRepository),
        new GetUserUseCase(userRepository),
    );

    return { controller };
}
