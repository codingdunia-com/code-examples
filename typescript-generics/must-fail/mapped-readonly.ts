// ReadonlyDeep<T> is a mapped type that adds readonly to every key, so the
// assignment below has to fail. A mapped type nobody tries to break is a
// mapped type nobody has checked.
type ReadonlyDeep<T> = { readonly [K in keyof T]: T[K] };

interface Settings {
  theme: string;
  fontSize: number;
}

const frozen: ReadonlyDeep<Settings> = { theme: 'dark', fontSize: 16 };
frozen.theme = 'light';
