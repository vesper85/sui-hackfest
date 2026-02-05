import { z } from "zod";

// Environment validation schema
export const envSchema = z.object({
    // Database
    DATABASE_URL: z.string().url(),

    // S3
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string(),
    S3_SECRET_ACCESS_KEY: z.string(),
    S3_BUCKET_NAME: z.string(),

    // OpenAI
    OPENAI_API_KEY: z.string().startsWith("sk-"),

    // Redis
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.string().default("6379"),
    REDIS_PASSWORD: z.string().optional(),

    // Application
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.string().default("3000"),
    JWT_SECRET: z.string().min(32),

    // Sui
    SUI_NETWORK: z.enum(["mainnet", "testnet", "devnet"]).default("testnet"),
    SUI_RPC_URL: z.string().url(),

    // Admin
    ADMIN_WALLET_ADDRESS: z.string().optional(),

    // Feature Flags
    ENABLE_AUTO_APPROVAL: z.string().transform(val => val === "true").default("false"),
    MAX_DOCUMENT_SIZE_MB: z.string().transform(val => parseInt(val, 10)).default("10"),
    LLM_PROVIDER: z.enum(["openai", "anthropic", "local"]).default("openai"),
});

export type Env = z.infer<typeof envSchema>;

// Validate and export environment
export const env = envSchema.parse(process.env);

// Export config
export const config = {
    database: {
        url: env.DATABASE_URL,
    },
    s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        bucketName: env.S3_BUCKET_NAME,
    },
    openai: {
        apiKey: env.OPENAI_API_KEY,
    },
    redis: {
        host: env.REDIS_HOST,
        port: parseInt(env.REDIS_PORT, 10),
        password: env.REDIS_PASSWORD,
    },
    app: {
        env: env.NODE_ENV,
        port: parseInt(env.PORT, 10),
    },
    jwt: {
        secret: env.JWT_SECRET,
    },
    sui: {
        network: env.SUI_NETWORK,
        rpcUrl: env.SUI_RPC_URL,
    },
    admin: {
        walletAddress: env.ADMIN_WALLET_ADDRESS,
    },
    features: {
        enableAutoApproval: env.ENABLE_AUTO_APPROVAL,
        maxDocumentSizeMb: env.MAX_DOCUMENT_SIZE_MB,
        llmProvider: env.LLM_PROVIDER,
    },
} as const;
