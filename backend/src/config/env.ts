import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_THINKER_MODEL: z.string().optional(),
  LLM_CODER_MODEL: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  BACKEND_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
