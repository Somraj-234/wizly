/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Wizly API, e.g. "https://api.wizly.space". Leave unset in local dev — Vite proxies /api to the backend instead. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
