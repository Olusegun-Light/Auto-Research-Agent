/**
 * Telegram Bot Entry Point
 * 
 * Uses Telegram Bot API (Telegraf) for:
 * - Receiving messages
 * - Responding with acknowledgments
 * - Executing research (2-3 minutes)
 * - Sending results when complete
 * - Delivering files directly
 */

import express from 'express';
import { TelegramBot } from './bot/telegramBot.js';
import { config } from './config/index.js';
import { Logger } from './utils/index.js';

const logger = new Logger('TelegramBot');

async function main() {
  try {
    // Check configuration
    if (!config.telegramBotToken) {
      console.error('❌ Error: TELEGRAM_BOT_TOKEN is not configured in .env');
      console.log('\nTo set up Telegram bot:');
      console.log('1. Talk to @BotFather on Telegram');
      console.log('2. Create a new bot with /newbot');
      console.log('3. Copy the bot token');
      console.log('4. Add to .env: TELEGRAM_BOT_TOKEN=your_token_here\n');
      process.exit(1);
    }

    if (!config.geminiApiKey && !config.openaiApiKey && !config.anthropicApiKey) {
      console.error('❌ Error: No AI provider configured');
      console.log('\nPlease add one of: GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY to .env\n');
      process.exit(1);
    }

    if (!config.serperApiKey && !config.braveApiKey && !config.googleSearchApiKey) {
      console.error('❌ Error: No search API configured');
      console.log('\nPlease add one of: SERPER_API_KEY, BRAVE_API_KEY, or GOOGLE_SEARCH_API_KEY to .env\n');
      process.exit(1);
    }

    // Display startup info
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   🤖 AutoResearch Agent - Telegram Bot                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    logger.info('Configuration:');
    logger.info(`  Bot Token: ${config.telegramBotToken.substring(0, 20)}...`);
    logger.info(`  AI Model: ${config.geminiApiKey ? 'Gemini' : config.openaiApiKey ? 'GPT-4' : 'Claude'}`);
    logger.info(`  Search API: ${config.serperApiKey ? 'Serper' : config.braveApiKey ? 'Brave' : 'Google'}`);
    logger.info(`  Output Dir: ${config.outputDir}`);
    console.log('');

    // Create and start bot
    const bot = new TelegramBot(config.telegramBotToken);
    await bot.start();

    // Start HTTP server for Render port binding
    const app = express();
    const PORT = parseInt(process.env.PORT || '3000', 10);

    app.get('/', (_req, res) => {
      res.json({
        status: 'running',
        service: 'AutoResearch Telegram Bot',
        timestamp: new Date().toISOString()
      });
    });

    app.get('/health', (_req, res) => {
      res.json({ status: 'healthy' });
    });

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`HTTP server listening on 0.0.0.0:${PORT}`);
      console.log(`🌐 HTTP server is accessible on port ${PORT}`);
    });

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   🚀 Bot is running!                                      ║');
    console.log('║   Send a message to your bot in Telegram                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    logger.info('How it works:');
    logger.info('  1. User sends research topic to bot');
    logger.info('  2. Bot acknowledges immediately');
    logger.info('  3. Research executes (2-3 minutes)');
    logger.info('  4. Bot sends results when complete');
    logger.info('  5. Files delivered directly to chat\n');

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Start the bot
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
