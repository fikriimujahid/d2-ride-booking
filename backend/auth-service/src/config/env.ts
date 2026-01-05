import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  AWS_REGION: z.string(),
  COGNITO_USER_POOL_ID: z.string(),
  COGNITO_CLIENT_ID: z.string(),
  COGNITO_CLIENT_SECRET: z.string(),
  
  // Seed Users
  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_PASSWORD: z.string(),
  DRIVER_EMAIL: z.string().email(),
  DRIVER_PASSWORD: z.string(),
  PASSENGER_EMAIL: z.string().email(),
  PASSENGER_PASSWORD: z.string(),
});

export const config = envSchema.parse(process.env);
