import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_CHAT_PATH: z.string().optional(),
  LLM_THINKER_MODEL: z.string().optional(),
  LLM_CODER_MODEL: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url().optional(),
  WORKSPACE_DIR: z.string().default('.guardrail-workspaces'),
  TOKEN_ENC_KEY: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = envSchema.parse(process.env);
