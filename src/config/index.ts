import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Configuration schema with validation
const configSchema = z.object({
  // AI Provider
  openaiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),

  // Search APIs
  serperApiKey: z.string().optional(),
  braveApiKey: z.string().optional(),
  googleSearchApiKey: z.string().optional(),
  googleSearchCx: z.string().optional(),

  // Google Docs Integration
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleRedirectUri: z.string().default('http://localhost:3000/oauth2callback'),

  // Telegram Bot Integration
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),

  // General Configuration
  maxSearchResults: z.number().default(25), // Increased from 10 to 25
  maxConcurrentRequests: z.number().default(8), // Increased from 5 to 8
  outputDir: z.string().default('./outputs'),
  reportFormats: z.array(z.enum(['markdown', 'pdf', 'googledocs'])).default(['markdown', 'pdf']),
});

type Config = z.infer<typeof configSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  const rawConfig = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    serperApiKey: process.env.SERPER_API_KEY,
    braveApiKey: process.env.BRAVE_API_KEY,
    googleSearchApiKey: process.env.GOOGLE_SEARCH_API_KEY,
    googleSearchCx: process.env.GOOGLE_SEARCH_CX,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS || '25'), // Increased default
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '8'), // Increased default
    outputDir: process.env.OUTPUT_DIR || './outputs',
    reportFormats: (process.env.REPORT_FORMAT || 'markdown,pdf')
      .split(',')
      .map(f => f.trim()) as ('markdown' | 'pdf' | 'googledocs')[],
  };

  return configSchema.parse(rawConfig);
}

/**
 * Validate that at least one AI provider is configured
 */
export function validateConfig(config: Config): void {
  if (!config.openaiApiKey && !config.anthropicApiKey && !config.geminiApiKey) {
    throw new Error('At least one AI provider API key (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY) must be configured');
  }

  if (!config.serperApiKey && !config.braveApiKey && !config.googleSearchApiKey) {
    throw new Error('At least one search API key must be configured (SERPER_API_KEY, BRAVE_API_KEY, or GOOGLE_SEARCH_API_KEY)');
  }
}

/**
 * Get the default AI model based on available API keys
 */
export function getDefaultModel(config: Config): string {
  if (config.geminiApiKey) return 'gemini-1.5-flash';
  if (config.openaiApiKey) return 'gpt-4o';
  if (config.anthropicApiKey) return 'claude-3-5-sonnet-20241022';
  return 'gemini-1.5-flash'; // Fallback
}

// Export singleton config instance
export const config = loadConfig();
validateConfig(config);
