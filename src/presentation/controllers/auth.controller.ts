import type { Request, Response } from "express";
import type {
    ChangePasswordUseCase,
    ListSessionsUseCase,
    LoginUseCase,
    LogoutAllUseCase,
    LogoutUseCase,
    RefreshTokenUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    VerifyResetTokenUseCase,
} from "../../application/use-cases/auth";
import type { GetUserUseCase } from "../../application/use-cases/users";
import type {
    ChangePasswordDto,
    ForgotPasswordDto,
    LoginDto,
    LogoutDto,
    RefreshTokenDto,
    ResetPasswordDto,
    VerifyResetTokenDto,
} from "../DTOs/request/auth";
import { toSessionResponse, toUserResponse } from "../DTOs/response";
import { getValidated } from "../validators";
import { requirePrincipal } from "../middleware";
import { noContent, ok } from "../response";

/**
 * Handlers are arrow-function properties so they can be passed directly to a
 * router without `.bind(this)`.
 *
 * There is no try/catch: Express 5 forwards a rejected promise from an async
 * handler to the error middleware on its own. Wrapping every handler in
 * try/catch-and-next(err), as Express 4 required, is now pure noise.
 */
export class AuthController {
    constructor(
        private readonly loginUseCase: LoginUseCase,
        private readonly refreshTokenUseCase: RefreshTokenUseCase,
        private readonly logoutUseCase: LogoutUseCase,
        private readonly logoutAllUseCase: LogoutAllUseCase,
        private readonly changePasswordUseCase: ChangePasswordUseCase,
        private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
        private readonly resetPasswordUseCase: ResetPasswordUseCase,
        private readonly verifyResetTokenUseCase: VerifyResetTokenUseCase,
        private readonly listSessionsUseCase: ListSessionsUseCase,
        private readonly getUserUseCase: GetUserUseCase,
    ) {}

    login = async (req: Request, res: Response): Promise<void> => {
        const body = getValidated<LoginDto>(res, "body");
        const result = await this.loginUseCase.execute({
            identifier: body.identifier,
            password: body.password,
            userAgent: req.get("user-agent") ?? undefined,
            ipAddress: req.ip,
        });
        ok(res, result);
    };

    refresh = async (req: Request, res: Response): Promise<void> => {
        const body = getValidated<RefreshTokenDto>(res, "body");
        const result = await this.refreshTokenUseCase.execute({
            refreshToken: body.refreshToken,
            userAgent: req.get("user-agent") ?? undefined,
            ipAddress: req.ip,
        });
        ok(res, result);
    };

    logout = async (_req: Request, res: Response): Promise<void> => {
        const body = getValidated<LogoutDto>(res, "body");
        await this.logoutUseCase.execute({ refreshToken: body.refreshToken });
        noContent(res);
    };

    logoutAll = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const result = await this.logoutAllUseCase.execute(principal.userId);
        ok(res, result, "Signed out of all devices");
    };

    changePassword = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<ChangePasswordDto>(res, "body");
        await this.changePasswordUseCase.execute(principal.userId, body);
        // Every session, including this one, is now revoked — the client must
        // sign in again. Saying so avoids a confusing 401 on the next call.
        ok(res, null, "Password changed. Please sign in again.");
    };

    forgotPassword = async (_req: Request, res: Response): Promise<void> => {
        const body = getValidated<ForgotPasswordDto>(res, "body");
        await this.requestPasswordResetUseCase.execute({ email: body.email });
        // Identical response whether or not the account exists.
        ok(res, null, "If an account exists for that address, a reset link has been sent.");
    };

    resetPassword = async (_req: Request, res: Response): Promise<void> => {
        const body = getValidated<ResetPasswordDto>(res, "body");
        await this.resetPasswordUseCase.execute(body);
        ok(res, null, "Password reset. Please sign in with your new password.");
    };

    verifyResetToken = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<VerifyResetTokenDto>(res, "query");
        ok(res, await this.verifyResetTokenUseCase.execute(query.token));
    };

    me = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const user = await this.getUserUseCase.execute(principal, principal.userId);
        ok(res, toUserResponse(user));
    };

    sessions = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const sessions = await this.listSessionsUseCase.execute(principal.userId);
        ok(res, sessions.map(toSessionResponse));
    };
}
