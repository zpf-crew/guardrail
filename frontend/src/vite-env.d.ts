/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. "http://localhost:3000". Required for all API calls. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
