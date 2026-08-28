export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

/** Every field optional, but `undefined` is not allowed to stand in for `null`. */
export type Patch<T> = { [K in keyof T]?: T[K] };

/** Compile-time exhaustiveness guard for switch statements over unions. */
export function assertNever(value: never, message = "Unexpected value"): never {
    throw new Error(`${message}: ${JSON.stringify(value)}`);
}
