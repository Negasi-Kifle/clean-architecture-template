/** Why a user's credentials were invalidated, for audit and messaging. */
export enum CredentialChangeReason {
    Email = "Email",
    Password = "Password",
    AdminReset = "AdminReset",
}
