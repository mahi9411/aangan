import { z } from 'zod'

const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined))

const envSchema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().min(1),
    PUBLIC_BASE_URL: z.string().url(),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    OTP_PEPPER: z.string().min(16),
    FIELD_ENCRYPTION_KEY: z.string().min(32),
    DEMO_MODE: z.enum(['true', 'false']).default('false'),
    ALLOW_DEV_OTP: z.enum(['true', 'false']).default('false'),
    OTP_DEV_CODE: optionalText,
    SMS_PROVIDER: z.enum(['console', 'msg91']).default('console'),
    MSG91_AUTH_KEY: optionalText,
    MSG91_TEMPLATE_ID: optionalText,
    PAYMENTS_MODE: z.enum(['mock', 'razorpay']).default('mock'),
    RAZORPAY_KEY_ID: optionalText,
    RAZORPAY_KEY_SECRET: optionalText,
    RAZORPAY_WEBHOOK_SECRET: optionalText,
    FCM_PROJECT_ID: optionalText,
    FCM_CLIENT_EMAIL: optionalText,
    FCM_PRIVATE_KEY: optionalText,
    GOOGLE_MAPS_API_KEY: optionalText,
    REDIS_URL: optionalText,
    DEFAULT_COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(1500),
    SEARCH_TIMEOUT_INSTANT_SEC: z.coerce.number().int().positive().default(180),
    SEARCH_TIMEOUT_SCHEDULED_SEC: z.coerce.number().int().positive().default(1800),
    STORAGE_DIR: z.string().default('uploads'),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const demo = value.DEMO_MODE === 'true'
    if (value.NODE_ENV === 'production' && !demo && value.ALLOW_DEV_OTP === 'true') {
      ctx.addIssue({ code: 'custom', message: 'ALLOW_DEV_OTP cannot be true in production', path: ['ALLOW_DEV_OTP'] })
    }
    if (value.NODE_ENV === 'production' && !demo && value.SMS_PROVIDER !== 'msg91') {
      ctx.addIssue({ code: 'custom', message: 'SMS_PROVIDER must be msg91 in production', path: ['SMS_PROVIDER'] })
    }
    if (value.ALLOW_DEV_OTP === 'true' && !/^\d{6}$/.test(value.OTP_DEV_CODE ?? '')) {
      ctx.addIssue({ code: 'custom', message: 'OTP_DEV_CODE must be 6 digits when dev OTP is enabled', path: ['OTP_DEV_CODE'] })
    }
    if (value.PAYMENTS_MODE === 'razorpay' && (!value.RAZORPAY_KEY_ID || !value.RAZORPAY_KEY_SECRET || !value.RAZORPAY_WEBHOOK_SECRET)) {
      ctx.addIssue({ code: 'custom', message: 'Razorpay key, secret, and webhook secret are required', path: ['RAZORPAY_KEY_ID'] })
    }
    if (value.SMS_PROVIDER === 'msg91' && (!value.MSG91_AUTH_KEY || !value.MSG91_TEMPLATE_ID)) {
      ctx.addIssue({ code: 'custom', message: 'MSG91 auth key and template id are required', path: ['MSG91_AUTH_KEY'] })
    }
  })

export function validateEnv(config: Record<string, unknown>) {
  if (!config.PUBLIC_BASE_URL && typeof config.RENDER_EXTERNAL_URL === 'string') {
    config.PUBLIC_BASE_URL = config.RENDER_EXTERNAL_URL
  }
  const parsed = envSchema.safeParse(config)
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
    throw new Error(`Invalid environment\n${message}`)
  }
  return parsed.data
}
