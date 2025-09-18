import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CHANNEL_ID: z.string().min(1, 'DISCORD_CHANNEL_ID is required'),
  BRIDGE_AUTH_TOKEN: z.string().min(8, 'BRIDGE_AUTH_TOKEN must be at least 8 characters'),
  BRIDGE_HOST: z.string().default('0.0.0.0'),
  BRIDGE_PORT: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : 8787))
    .pipe(z.number().int().min(1).max(65535)),
  LOG_LEVEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const env: Env = envSchema.parse(process.env);

export default env;
