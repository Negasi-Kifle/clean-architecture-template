/** Hashing port. The algorithm (bcrypt, argon2, scrypt) is an infrastructure choice. */
export interface IPasswordHasher {
    hash(plaintext: string): Promise<string>;
    /** Must be constant-time with respect to the hash comparison. */
    compare(plaintext: string, hash: string): Promise<boolean>;
}
