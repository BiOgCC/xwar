// ══════════════════════════════════════════════════════════════
// SIMULATOR — Vite Environment Shim
// Must be imported BEFORE any game store code that uses import.meta.env
// ══════════════════════════════════════════════════════════════

// Stub import.meta.env for Node.js (Vite provides this in browser)
// @ts-ignore
if (typeof import.meta.env === 'undefined') {
  // @ts-ignore
  import.meta.env = { DEV: false, PROD: true, MODE: 'production', SSR: true }
}

// Stub window/document/localStorage for zustand stores that touch DOM
if (typeof globalThis.window === 'undefined') {
  // @ts-ignore
  globalThis.window = { addEventListener: () => {}, removeEventListener: () => {}, innerWidth: 1920, innerHeight: 1080 }
}
if (typeof globalThis.document === 'undefined') {
  // @ts-ignore
  globalThis.document = { addEventListener: () => {}, removeEventListener: () => {}, createElement: () => ({ style: {} }), body: { appendChild: () => {} } }
}
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {}
  // @ts-ignore
  globalThis.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}
