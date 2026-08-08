import { z } from 'zod';
import { createEnv } from '@t3-oss/env-nextjs';

export const env = createEnv({
  /*
   * ServerSide Environment variables, not available on the client.
   */
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url(),

    // email
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM_EMAIL: z.string().email().optional(),
  },
  /*
   * Environment variables available on the client (and server).
   */
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_MAP_API_KEY: z.string().optional().default(''),
    NEXT_PUBLIC_API_URL: z.string().url().optional().default('http://localhost:5001'),
    // Public storefront origin. The admin app has no /product/[slug] route of
    // its own — that page lives in the platform app — so anything linking a
    // shopper-facing product page must use this absolute origin rather than a
    // path relative to the admin host.
    NEXT_PUBLIC_STOREFRONT_URL: z
      .string()
      .url()
      .optional()
      .default('https://www.drinksharbour.com'),
  },
  runtimeEnv: process.env,
});
