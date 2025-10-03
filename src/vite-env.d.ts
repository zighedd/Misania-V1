/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_OPENAI_API_KEY: string
  readonly VITE_OPENAI_MODEL_NAME: string
  readonly VITE_OPENAI_PROMPT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
