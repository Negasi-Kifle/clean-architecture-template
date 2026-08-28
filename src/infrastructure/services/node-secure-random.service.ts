import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { ISecureRandom } from "../../domain/services";

export class NodeSecureRandom implements ISecureRandom {
    /**
     * 32 bytes by default: 256 bits of entropy, base64url-encoded. Anything
     * shorter is guessable at scale; `Math.random()` is not a CSPRNG and must
     * never appear anywhere near a token.
     */
    opaqueToken(byteLength = 32): string {
        return randomBytes(byteLength).toString("base64url");
    }

    /**
     * For token digests ONLY.
     *
     * A refresh token is 256 bits of uniform randomness, so a plain SHA-256 is
     * the right store: there is nothing to brute-force. Passwords are the
     * opposite case and go through bcrypt — never through this.
     */
    sha256(value: string): string {
        return createHash("sha256").update(value).digest("hex");
    }

    uuid(): string {
        return randomUUID();
    }
}
