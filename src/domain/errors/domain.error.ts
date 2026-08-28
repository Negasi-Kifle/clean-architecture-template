/**
 * Base class for every error the domain and application layers may throw.
 *
 * Deliberately carries NO HTTP concepts. The presentation layer owns the
 * mapping from error type to status code (see `error-handler.middleware.ts`),
 * which is what lets the same use case run behind HTTP, a queue consumer or a
 * CLI without dragging Express into the core.
 *
 * `code` is a stable, machine-readable string. Clients should branch on it,
 * never on `message` — messages are for humans and will be reworded.
 */
export abstract class DomainError extends Error {
    abstract readonly code: string;

    /** Safe to send to the client. Internal-only errors set this to false. */
    readonly isOperational: boolean = true;

    protected constructor(message: string) {
        super(message);
        this.name = new.target.name;
        Error.captureStackTrace?.(this, new.target);
    }
}
