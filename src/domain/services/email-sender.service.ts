export interface PasswordResetEmail {
    to: string;
    recipientName: string;
    resetUrl: string;
    expiresInMinutes: number;
}

export interface WelcomeEmail {
    to: string;
    recipientName: string;
    temporaryPassword?: string;
    loginUrl: string;
}

/**
 * Outbound mail port.
 *
 * Implementations must not throw into the caller's control flow for transport
 * failures: a password-reset request that fails to send an email still has to
 * return the same response as one that succeeds, or the endpoint becomes an
 * account-enumeration oracle.
 */
export interface IEmailSender {
    sendPasswordReset(email: PasswordResetEmail): Promise<void>;
    sendWelcome(email: WelcomeEmail): Promise<void>;
}
