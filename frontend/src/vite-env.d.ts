/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. "http://localhost:3000". */
  readonly VITE_API_BASE_URL?: string;
  /** Explicitly use mock data for the Generate/Improve workbench. */
  readonly VITE_WORKBENCH_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
