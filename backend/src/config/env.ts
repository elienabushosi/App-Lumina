import { config } from 'dotenv';
import { z } from 'zod';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}` });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3002'),

  // Supabase
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1),

  // Salesforce / APEX Agent
  SF_LOGIN_URL: z.string().url().default('https://eagentsaml.farmersinsurance.com/login.html'),
  SF_SESSION_DIR: z.string().default('./sessions'),
  // Per-agent credentials (keyed by agentId with hyphens replaced by underscores, uppercased)
  SF_USERNAME_JAKE_RIDLEY: z.string().optional(),
  SF_PASSWORD_JAKE_RIDLEY: z.string().optional(),
  SF_USERNAME_CG_AGENT_001: z.string().optional(),
  SF_PASSWORD_CG_AGENT_001: z.string().optional(),

  // Gemini (Computer Use)
  GEMINI_API_KEY: z.string().optional(),

  // Redis (BullMQ)
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // ATTOM Data API (property research)
  ATTOM_API_KEY: z.string().optional(),

  // RealtyAPI (Zillow data)
  REALTY_API_KEY: z.string().optional(),

  // Optional — already in existing backend, carried forward
  DEEPGRAM_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${missing}`);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = z.infer<typeof envSchema>;
