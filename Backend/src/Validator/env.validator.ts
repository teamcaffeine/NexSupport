import { z } from 'zod';

/**
 * Environment Schema
 */
const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => Number(val))
    .refine((val) => !isNaN(val), {
      message: 'PORT must be a number',
    }),

  MONGODB_URL: z.string().min(1, 'MONGODB_URL is required').url('MONGODB_URL must be a valid URL'),

  JWT_SECRET: z.string().min(6, 'JWT_SECRET must be at least 6 characters'),

  REDIS_URL: z.string().url('REDIS_URL must be a valid URL').optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validate env
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
