import bcrypt from "bcryptjs";
import type { IPasswordHasher } from "../../domain/services";

/**
 * bcrypt adapter.
 *
 * The cost factor is injected from config rather than hardcoded, because the
 * right value is hardware- and year-dependent: it should be raised over time,
 * and raising it must not require a code change and a deploy.
 */
export class BcryptPasswordHasher implements IPasswordHasher {
    constructor(private readonly cost: number) {}

    async hash(plaintext: string): Promise<string> {
        return bcrypt.hash(plaintext, this.cost);
    }

    async compare(plaintext: string, hash: string): Promise<boolean> {
        // bcrypt.compare is constant-time with respect to the digest and does
        // not throw on a malformed hash, which is what keeps the "unknown user"
        // timing-equalizer path in the login use case honest.
        return bcrypt.compare(plaintext, hash);
    }
}
