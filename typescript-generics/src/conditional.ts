// Conditional and mapped types from the guide's later sections. Nothing here
// emits any JavaScript, so main.ts checks them the only way type-level code can
// be checked at runtime: by asserting the values that must satisfy them.

export type Unwrapped<T> = T extends Promise<infer U> ? U : T;

export type Nullable<T> = { [K in keyof T]: T[K] | null };

export type ReadonlyDeep<T> = { readonly [K in keyof T]: T[K] };

// A value of this type only compiles if Unwrapped strips exactly one Promise
// layer. If the conditional type were wrong, this file would not build.
export const unwrappedIsString: Unwrapped<Promise<string>> = 'strings survive';
export const unwrappedPassesThrough: Unwrapped<number> = 7;

export interface Settings {
  readonly theme: string;
  readonly fontSize: number;
}

export const partiallyUnset: Nullable<Settings> = { theme: null, fontSize: 14 };
