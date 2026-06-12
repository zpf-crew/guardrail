/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. "http://localhost:3000". Unset → frontend uses mock data. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
