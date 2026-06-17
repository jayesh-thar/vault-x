/// <reference types="vite/client" />
declare const __GOOGLE_CLIENT_ID__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WEB_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
