/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BEDROCK_MODEL_ID?: string
  readonly VITE_BEDROCK_REGION?: string
  readonly VITE_BEDROCK_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
