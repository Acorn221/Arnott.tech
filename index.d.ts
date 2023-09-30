declare module '*.scss' {
  const css: { [key: string]: string };
  export default css;
}
declare module '*.sass' {
  const css: { [key: string]: string };
  export default css;
}
declare module 'react-markup';
declare module '*.webp';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_PUBLIC_GTAG_ID: string
  readonly VITE_PUBLIC_SECRET_API_KEY: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
