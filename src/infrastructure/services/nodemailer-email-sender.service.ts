import nodemailer, { type Transporter } from "nodemailer";
import type { IEmailSender, PasswordResetEmail, WelcomeEmail } from "../../domain/services";
import { logger } from "../../shared/logger";

export interface SmtpOptions {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    password?: string;
    from: string;
    fromName: string;
}

export class NodemailerEmailSender implements IEmailSender {
    private readonly transporter: Transporter;

    constructor(private readonly options: SmtpOptions) {
        this.transporter = nodemailer.createTransport({
            host: options.host,
            port: options.port,
            secure: options.secure,
            ...(options.user && options.password
                ? { auth: { user: options.user, pass: options.password } }
                : {}),
        });
    }

    async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
        await this.send({
            to: email.to,
            subject: "Reset your password",
            text: [
                `Hi ${email.recipientName},`,
                "",
                "Use the link below to choose a new password:",
                email.resetUrl,
                "",
                `This link expires in ${email.expiresInMinutes} minutes and can be used once.`,
                "If you did not request this, you can ignore this email.",
            ].join("\n"),
        });
    }

    async sendWelcome(email: WelcomeEmail): Promise<void> {
        await this.send({
            to: email.to,
            subject: "Your account is ready",
            text: [
                `Hi ${email.recipientName},`,
                "",
                "An account has been created for you.",
                `Sign in: ${email.loginUrl}`,
                ...(email.temporaryPassword
                    ? [
                          "",
                          `Temporary password: ${email.temporaryPassword}`,
                          "You will be asked to change it on first sign-in.",
                      ]
                    : []),
            ].join("\n"),
        });
    }

    private async send(message: { to: string; subject: string; text: string }): Promise<void> {
        await this.transporter.sendMail({
            from: `"${this.options.fromName}" <${this.options.from}>`,
            ...message,
        });
    }
}

/**
 * Used when SMTP is not configured.
 *
 * Logs the message instead of sending it, so local development and CI have a
 * working password-reset flow without an SMTP server, and so a missing SMTP
 * config surfaces as a visible log line rather than a silent no-op.
 */
export class LoggingEmailSender implements IEmailSender {
    async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
        logger.info(
            { to: email.to, resetUrl: email.resetUrl, expiresInMinutes: email.expiresInMinutes },
            "[email:disabled] password reset — SMTP not configured, link logged instead of sent",
        );
    }

    async sendWelcome(email: WelcomeEmail): Promise<void> {
        logger.info(
            { to: email.to, loginUrl: email.loginUrl },
            "[email:disabled] welcome email — SMTP not configured",
        );
    }
}
