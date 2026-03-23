/**
 * Telegram Bot - Direct API Implementation
 * 
 * Uses Telegraf (Telegram Bot API) for:
 * - Receiving messages
 * - Sending responses
 * - Executing research
 * - Delivering files
 */

import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { AutoResearchAgent } from '../agents/AutoResearchAgent.js';
import { extractCleanTopic } from '../agents/specialized/index.js';
import type { ResearchTopic, ResearchMode } from '../types/index.js';
import { Logger } from '../utils/index.js';
import { config, getDefaultModel } from '../config/index.js';
import { Input } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('TelegramBot');

export class TelegramBot {
  private bot: Telegraf;
  private researchAgent: AutoResearchAgent;
  private currentCtx?: Context;
  private userHistory: Map<number, string[]> = new Map();
  private userPreferences: Map<number, { depth: 'basic' | 'intermediate' | 'comprehensive' }> = new Map();
  private pendingResearch: Map<number, { topic: string; depth?: 'basic' | 'intermediate' | 'comprehensive' }> = new Map();

  constructor(botToken: string) {
    this.bot = new Telegraf(botToken);
    
    // Create research agent with progress callback
    this.researchAgent = new AutoResearchAgent(async (stage: string, details: string) => {
      await this.sendProgressUpdate(stage, details);
    });
    
    this.setupHandlers();
  }

  /**
   * Send progress update to current chat
   */
  private async sendProgressUpdate(stage: string, details: string): Promise<void> {
    if (this.currentCtx) {
      try {
        await this.currentCtx.reply(`${stage}\n${details}`);
      } catch (error) {
        logger.error('Failed to send progress update:', error);
      }
    }
  }

  /**
   * Set up message handlers
   */
  private setupHandlers(): void {
    // /start command
    this.bot.start((ctx) => {
      const welcomeMessage = `
🤖 *Welcome to AutoResearch Agent!*

I'm an AI-powered research assistant that conducts comprehensive research on any topic.

*What I Can Do:*
🔍 Multi-source web search
📊 AI-powered analysis
📄 Generate professional reports (PDF + Markdown)
📤 Deliver files directly to you

*How to Use:*
Simply send me a research topic!

*Examples:*
• Artificial Intelligence in Healthcare
• Climate Change Effects
• Quantum Computing Basics

*Commands:*
/start - Show this message
/help - Get help

Ready to start? Send me a topic! 🚀
`;
      ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    });

    // /help command
    this.bot.help((ctx) => {
      const helpMessage = `
📚 *AutoResearch Agent - Help*

*How It Works:*
1. You send a research topic
2. I search multiple sources (2-3 minutes)
3. AI analyzes and synthesizes findings
4. I generate professional reports
5. You receive PDF + Markdown files

*Tips:*
✅ Be specific: "AI in Healthcare" not just "AI"
✅ Ask follow-up questions anytime
✅ Research takes 2-3 minutes - please wait

*What You'll Get:*
📄 PDF Report - Formatted, professional
📝 Markdown Report - Raw text format
📚 Citations - All sources cited

*Commands:*
/start - Show welcome message
/help - Show this help
/history - View your research history
/settings - Adjust your preferences
/cancel - Cancel ongoing research

*Having Issues?*
Just ask! I'm here to help.

Send a topic to get started! 🔬
`;
      ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    });

    // /history command
    this.bot.command('history', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const history = this.userHistory.get(userId) || [];
      
      if (history.length === 0) {
        await ctx.reply(
          `📚 *Research History*\n\n` +
          `No research history yet! Start by sending me a topic.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        const historyText = history
          .slice(-10)
          .reverse()
          .map((topic, index) => `${index + 1}. ${topic}`)
          .join('\n');

        await ctx.reply(
          `📚 *Your Recent Research* (last 10)\n\n` +
          `${historyText}\n\n` +
          `💡 Want to research any of these again? Just send the topic!`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    // /settings command
    this.bot.command('settings', async (ctx) => {
      const userId = ctx.from?.id;
      if (!userId) return;

      const prefs = this.userPreferences.get(userId) || { depth: 'intermediate' };
      
      await ctx.reply(
        `⚙️ *Your Settings*\n\n` +
        `Current research depth: *${prefs.depth}*\n\n` +
        `Change default depth:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '⚡ Basic (3 sources)', callback_data: 'pref_basic' },
              { text: '📚 Intermediate (5 sources)', callback_data: 'pref_intermediate' },
              { text: '🔬 Comprehensive (10+ sources)', callback_data: 'pref_comprehensive' }
            ]]
          }
        }
      );
    });

    // /cancel command
    this.bot.command('cancel', async (ctx) => {
      await ctx.reply(
        `⏹️ *Research Cancelled*\n\n` +
        `No problem! Send me a new topic whenever you're ready.`,
        { parse_mode: 'Markdown' }
      );
    });

    // Handle all text messages
    this.bot.on(message('text'), async (ctx) => {
      const userMessage = ctx.message.text;
      const chatId = ctx.chat.id;

      // Ignore commands (already handled)
      if (userMessage.startsWith('/')) {
        return;
      }

      logger.info(`Received message from ${chatId}: ${userMessage}`);

      // Determine if this is a research request or just a conversation
      const shouldResearch = await this.shouldExecuteResearch(userMessage, ctx);

      if (shouldResearch) {
        // Extract the actual research topic from the message
        const topic = await this.extractResearchTopic(userMessage, ctx);
        
        // Save for depth + mode selection
        const userId = ctx.from?.id;
        if (userId) {
          this.pendingResearch.set(userId, { topic });
        }

        // Ask user to select research depth
        await ctx.reply(
          `📊 *Research Topic:* "${topic}"\n\n` +
          `Choose research depth:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚡ Quick (3 sources, ~1-2 min)', callback_data: 'depth_basic' }],
                [{ text: '📚 Standard (5 sources, ~2-3 min)', callback_data: 'depth_intermediate' }],
                [{ text: '🔬 Deep (10+ sources, ~3-5 min)', callback_data: 'depth_comprehensive' }]
              ]
            }
          }
        );
      } else {
        // Handle as normal conversation
        await this.handleConversation(userMessage, ctx);
      }
    });

    // Handle callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (ctx) => {
      if (!('data' in ctx.callbackQuery)) return;
      
      const data = ctx.callbackQuery.data;
      const userId = ctx.from?.id;

      if (!userId) return;

      // Handle preference changes
      if (data?.startsWith('pref_')) {
        const depth = data.replace('pref_', '') as 'basic' | 'intermediate' | 'comprehensive';
        this.userPreferences.set(userId, { depth });
        
        await ctx.answerCbQuery('✅ Preference saved!');
        await ctx.editMessageText(
          `⚙️ *Settings Updated*\n\n` +
          `Default research depth: *${depth}*\n\n` +
          `This will be used for your future research.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Handle research depth selection - now shows mode keyboard next
      if (data?.startsWith('depth_')) {
        const depth = data.replace('depth_', '') as 'basic' | 'intermediate' | 'comprehensive';
        const pending = this.pendingResearch.get(userId);

        if (!pending) {
          await ctx.answerCbQuery('❌ Topic not found. Please try again.');
          return;
        }

        // Save depth choice and show mode selection
        this.pendingResearch.set(userId, { topic: pending.topic, depth });

        await ctx.answerCbQuery('✅ Depth selected!');
        await ctx.editMessageText(
          `📊 *Topic:* "${pending.topic}"\n🔍 *Depth:* ${depth}\n\nNow choose a research mode:`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⚡ Fast', callback_data: 'mode_fast' },
                  { text: '📚 Standard', callback_data: 'mode_standard' },
                ],
                [
                  { text: '🔬 Deep', callback_data: 'mode_deep' },
                  { text: '🔍 Critical', callback_data: 'mode_critical' },
                  { text: '📊 Data', callback_data: 'mode_data' },
                ],
              ]
            }
          }
        );
        return;
      }

      // Handle research mode selection - launches research
      if (data?.startsWith('mode_')) {
        const mode = data.replace('mode_', '') as ResearchMode;
        const pending = this.pendingResearch.get(userId);

        if (!pending || !pending.depth) {
          await ctx.answerCbQuery('❌ Session expired. Please start over.');
          return;
        }

        const { topic, depth } = pending;
        this.pendingResearch.delete(userId);

        await ctx.answerCbQuery('🚀 Starting research...');
        await ctx.editMessageText(
          `✅ Starting *${mode}* mode (${depth} depth) research on:\n"${topic}"`,
          { parse_mode: 'Markdown' }
        );

        await this.executeResearchWithDepth(topic, depth, mode, ctx);
        return;
      }

      // Default: unknown callback
      await ctx.answerCbQuery('Unknown action');
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Bot error:', err);
      ctx.reply('❌ Sorry, an error occurred. Please try again.');
    });
  }

  /**
   * Determine if the user message is a research request
   */
  private async shouldExecuteResearch(userMessage: string, ctx: Context): Promise<boolean> {
    const messageLower = userMessage.toLowerCase();

    // Clear research indicators
    const researchKeywords = [
      'research',
      'find information about',
      'tell me about',
      'what is',
      'what are',
      'explain',
      'analyze',
      'investigate',
      'study',
      'look into',
      'search for',
      'find out about',
      'learn about',
      'write a report on',
      'generate a report',
      'create a report'
    ];

    // Check for research keywords
    const hasResearchKeyword = researchKeywords.some(keyword => 
      messageLower.includes(keyword)
    );

    // Check if message is long and detailed (likely a research topic)
    const isDetailedTopic = userMessage.split(' ').length > 3 && 
                           !messageLower.startsWith('how are') &&
                           !messageLower.startsWith('hi') &&
                           !messageLower.startsWith('hello') &&
                           !messageLower.startsWith('thanks') &&
                           !messageLower.startsWith('thank you');

    // Greetings and casual conversation
    const casualPhrases = [
      'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
      'how are you', 'whats up', "what's up", 'sup',
      'thanks', 'thank you', 'thx', 'bye', 'goodbye', 'see you',
      'ok', 'okay', 'cool', 'nice', 'great', 'awesome',
      'yes', 'no', 'maybe', 'sure', 'why', 'when', 'where'
    ];

    const isCasual = casualPhrases.some(phrase => 
      messageLower.startsWith(phrase) || messageLower === phrase
    );

    // If it's a casual message, don't research
    if (isCasual && !hasResearchKeyword) {
      return false;
    }

    // If it has research keywords, definitely research
    if (hasResearchKeyword) {
      return true;
    }

    // If it's a detailed topic (4+ words) but not casual, ask for confirmation
    if (isDetailedTopic) {
      await ctx.reply(
        `🤔 Did you want me to research "${userMessage}"?\n\n` +
        `Reply with:\n` +
        `• "yes" or "research it" - to start research\n` +
        `• "no" or any other message - to continue chatting`,
        { parse_mode: 'Markdown' }
      );
      return false; // Wait for confirmation
    }

    // Default: treat as conversation
    return false;
  }

  /**
   * Extract the actual research topic from a message using ADK-TS agent
   */
  private async extractResearchTopic(userMessage: string, _ctx: Context): Promise<string> {
    try {
      // Use ADK-TS TopicExtractorAgent for intelligent extraction
      const model = getDefaultModel(config);
      const cleanTopic = await extractCleanTopic(userMessage, model);
      
      logger.success(`Extracted topic: "${cleanTopic}" from "${userMessage}"`);
      return cleanTopic;
      
    } catch (error) {
      logger.error('Topic extraction failed, using fallback:', error);
      
      // Fallback: simple regex-based extraction
      return this.fallbackTopicExtraction(userMessage);
    }
  }

  /**
   * Fallback topic extraction (if AI fails)
   */
  private fallbackTopicExtraction(userMessage: string): string {
    let topic = userMessage.trim();

    // Remove common conversational prefixes
    const prefixes = [
      /^i want to (do )?research (on |about )?/i,
      /^can you (please )?research (on |about )?/i,
      /^could you (please )?research (on |about )?/i,
      /^please research (on |about )?/i,
      /^research (on |about )?/i,
      /^i want to (learn|know) (about |on )?/i,
      /^tell me (about |on )?/i,
      /^can you tell me (about |on )?/i,
      /^could you tell me (about |on )?/i,
      /^what (is|are) /i,
      /^find (information|info) (about |on )?/i,
      /^i('m| am) curious about /i,
      /^i('m| am) interested in /i,
    ];

    for (const prefix of prefixes) {
      topic = topic.replace(prefix, '');
    }

    // Remove trailing politeness
    topic = topic.replace(/(,? )?(please|thanks|thank you)\.?$/i, '');
    
    // Remove trailing "for me"
    topic = topic.replace(/ for me\.?$/i, '');

    // Trim and return
    return topic.trim();
  }

  /**
   * Handle normal conversation (not research)
   */
  private async handleConversation(userMessage: string, ctx: Context): Promise<void> {
    const messageLower = userMessage.toLowerCase();

    // Greetings
    if (messageLower.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      await ctx.reply(
        `Hello! 👋\n\n` +
        `I'm AutoResearch Agent, your AI-powered research assistant!\n\n` +
        `*What I can do:*\n` +
        `🔍 Research any topic in depth\n` +
        `📊 Generate professional reports\n` +
        `📄 Deliver PDF + Markdown files\n\n` +
        `*To start research, try:*\n` +
        `• "Research Artificial Intelligence"\n` +
        `• "Tell me about Climate Change"\n` +
        `• "What is Quantum Computing?"\n\n` +
        `Or just chat with me! What would you like to know? 🚀`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Thank you
    if (messageLower.match(/(thanks|thank you|thx)/)) {
      await ctx.reply(
        `You're welcome! 😊\n\n` +
        `Feel free to ask me to research anything else!`
      );
      return;
    }

    // Goodbye
    if (messageLower.match(/(bye|goodbye|see you)/)) {
      await ctx.reply(
        `Goodbye! 👋\n\n` +
        `Come back anytime you need research done!`
      );
      return;
    }

    // "How are you"
    if (messageLower.match(/how are you|how're you/)) {
      await ctx.reply(
        `I'm doing great, thanks for asking! 🤖\n\n` +
        `I'm always ready to help with research. What topic interests you?`
      );
      return;
    }

    // Affirmations (yes, sure, ok)
    if (messageLower.match(/^(yes|yeah|yep|sure|ok|okay|research it|do it|go ahead)$/)) {
      await ctx.reply(
        `Great! Please tell me what topic you'd like me to research.\n\n` +
        `*Examples:*\n` +
        `• Artificial Intelligence in Healthcare\n` +
        `• Climate Change Impact on Agriculture\n` +
        `• History of Quantum Computing\n\n` +
        `Just type the topic! 📚`
      );
      return;
    }

    // Generic help/questions
    if (messageLower.match(/(what can you do|help|capabilities|features)/)) {
      await ctx.reply(
        `🤖 *AutoResearch Agent Capabilities*\n\n` +
        `I conduct comprehensive research on any topic:\n\n` +
        `*Process:*\n` +
        `1️⃣ Search multiple sources\n` +
        `2️⃣ Extract relevant content\n` +
        `3️⃣ AI-powered analysis\n` +
        `4️⃣ Generate professional reports\n` +
        `5️⃣ Deliver PDF + Markdown files\n\n` +
        `*How to use:*\n` +
        `Just say "Research [topic]" or "Tell me about [topic]"\n\n` +
        `*Examples:*\n` +
        `• Research Machine Learning\n` +
        `• Tell me about Renewable Energy\n` +
        `• What is Blockchain Technology?\n\n` +
        `Ready when you are! 🚀`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Default response for unclear messages
    await ctx.reply(
      `I'm not sure what you'd like me to do! 🤔\n\n` +
      `*For research, say:*\n` +
      `• "Research [topic]"\n` +
      `• "Tell me about [topic]"\n` +
      `• Or ask "What is [topic]?"\n\n` +
      `*For help:*\n` +
      `• Send /help for detailed info\n\n` +
      `*Just chatting?*\n` +
      `• I'm here to talk too! Ask me anything 😊`
    );
  }

  /**
   * Execute research with specific depth and send results
   */
  private async executeResearchWithDepth(
    topic: string,
    depth: 'basic' | 'intermediate' | 'comprehensive',
    mode: ResearchMode,
    ctx: Context
  ): Promise<void> {
    try {
      logger.info(`Starting ${depth} research on: ${topic}`);
      
      // Set current context for progress updates
      this.currentCtx = ctx;

      // Save to history
      const userId = ctx.from?.id;
      if (userId) {
        const history = this.userHistory.get(userId) || [];
        history.push(topic);
        this.userHistory.set(userId, history);
      }

      // Configure research based on depth
      const maxSources = depth === 'basic' ? 3 : depth === 'comprehensive' ? 10 : 5;
      
      const researchTopic: ResearchTopic = {
        topic,
        depth,
        maxSources,
        includeVisualization: depth === 'comprehensive',
        mode,
      };

      // Execute research (with real-time progress updates)
      const outputPaths = await this.researchAgent.research(researchTopic);

      logger.success(`Research complete! Generated ${outputPaths.length} files`);

      // Send files
      await ctx.reply(
        `📦 *Delivering Your Research Reports*\n\n` +
        `Sending ${outputPaths.length} files...`,
        { parse_mode: 'Markdown' }
      );

      for (const filePath of outputPaths) {
        await this.sendFile(ctx, filePath, topic);
      }

      // Send final message with suggestions
      const suggestions = this.getSuggestedTopics(topic, userId);
      let finalMessage = `✅ *All reports delivered!*\n\n💡 Ready for another research topic?\nJust send me any topic you'd like to research! 🚀`;
      
      if (suggestions.length > 0) {
        finalMessage += `\n\n📚 *You might also like:*\n${suggestions.map(t => `• ${t}`).join('\n')}`;
      }

      await ctx.reply(finalMessage, { parse_mode: 'Markdown' });

      logger.success(`Research delivery complete for: ${topic}`);

    } catch (error) {
      logger.error('Research failed:', error);

      await ctx.reply(
        `❌ *Research failed*\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        `Please try again with a different topic or rephrase your request.`,
        { parse_mode: 'Markdown' }
      );
    } finally {
      // Clear context
      this.currentCtx = undefined;
    }
  }

  /**
   * Get suggested topics based on current topic and history
   */
  private getSuggestedTopics(currentTopic: string, _userId?: number): string[] {
    // Simple suggestions based on keywords
    const topicLower = currentTopic.toLowerCase();
    const suggestions: string[] = [];

    // AI-related suggestions
    if (topicLower.includes('ai') || topicLower.includes('artificial intelligence')) {
      suggestions.push('Machine Learning Applications', 'Neural Networks');
    }
    
    // Climate-related suggestions
    if (topicLower.includes('climate') || topicLower.includes('environment')) {
      suggestions.push('Renewable Energy', 'Carbon Capture Technology');
    }
    
    // Tech-related suggestions
    if (topicLower.includes('quantum') || topicLower.includes('computing')) {
      suggestions.push('Cloud Computing', 'Edge Computing');
    }

    // Healthcare-related suggestions
    if (topicLower.includes('health') || topicLower.includes('medical')) {
      suggestions.push('Telemedicine', 'Precision Medicine');
    }

    return suggestions.slice(0, 2); // Max 2 suggestions
  }

  /**
   * Send a file to the chat
   */
  private async sendFile(
    ctx: Context,
    filePath: string,
    topic: string
  ): Promise<void> {
    try {
      if (!fs.existsSync(filePath)) {
        logger.error(`File not found: ${filePath}`);
        return;
      }

      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();

      logger.info(`Sending ${fileName}...`);

      // Determine file icon and caption
      let icon = '📄';
      let fileType = 'Report';

      if (fileExtension === '.pdf') {
        icon = '📄';
        fileType = 'PDF Report';
      } else if (fileExtension === '.md' || fileExtension === '.markdown') {
        icon = '📝';
        fileType = 'Markdown Report';
      }

      const caption = `${icon} *${fileType}*\n📊 Topic: ${topic}`;

      // Send document
      await ctx.replyWithDocument(
        Input.fromLocalFile(filePath),
        {
          caption,
          parse_mode: 'Markdown'
        }
      );

      logger.success(`✅ Sent ${fileName}`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      logger.error(`Failed to send ${filePath}:`, error);

      // Retry once if failed
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await ctx.replyWithDocument(Input.fromLocalFile(filePath));
        logger.success(`✅ Sent ${filePath} (retry successful)`);
      } catch (retryError) {
        logger.error(`Failed to send ${filePath} after retry:`, retryError);
      }
    }
  }

  /**
   * Set up bot commands menu
   */
  private async setupBotCommands(): Promise<void> {
    try {
      await this.bot.telegram.setMyCommands([
        { command: 'start', description: '🚀 Start the bot and see welcome message' },
        { command: 'help', description: '❓ Get help and usage instructions' },
        { command: 'history', description: '📚 View your research history' },
        { command: 'settings', description: '⚙️ Adjust your preferences' },
        { command: 'cancel', description: '⏹️ Cancel ongoing research' },
      ]);
      logger.success('Bot commands menu configured');
    } catch (error) {
      logger.warn('Failed to set bot commands:', error);
    }
  }

  /**
   * Start the bot (polling mode - for local development)
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Telegram bot in polling mode...');

      // Verify bot token
      const botInfo = await this.bot.telegram.getMe();
      logger.success(`Bot connected: @${botInfo.username}`);

      // Set up bot commands menu
      await this.setupBotCommands();

      // Launch bot with graceful stop
      await this.bot.launch();

      logger.success('✅ Bot is running and listening for messages (polling mode)!');

      // Enable graceful stop
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));

    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  /**
   * Get bot information
   */
  async getBotInfo() {
    return await this.bot.telegram.getMe();
  }

  /**
   * Setup webhook configuration (without starting server)
   */
  async setupWebhook(webhookUrl: string, webhookPath: string, app: any): Promise<void> {
    try {
      // Set up bot commands menu
      await this.setupBotCommands();

      // Set webhook
      await this.bot.telegram.setWebhook(webhookUrl);
      logger.success(`Webhook set to: ${webhookUrl}`);

      // Add webhook callback to Express app
      app.use(this.bot.webhookCallback(webhookPath));
      logger.success(`Webhook callback configured for path: ${webhookPath}`);

      // Enable graceful stop
      process.once('SIGINT', () => this.stopWebhook('SIGINT'));
      process.once('SIGTERM', () => this.stopWebhook('SIGTERM'));

    } catch (error) {
      logger.error('Failed to setup webhook:', error);
      throw error;
    }
  }

  /**
   * Start the bot with webhook (for production deployment)
   */
  async startWebhook(
    webhookUrl: string,
    webhookPath: string,
    app: any,
    port: number
  ): Promise<void> {
    try {
      logger.info('Starting Telegram bot in webhook mode...');

      // Verify bot token
      const botInfo = await this.bot.telegram.getMe();
      logger.success(`Bot connected: @${botInfo.username}`);

      // Set up bot commands menu
      await this.setupBotCommands();

      // Set webhook
      await this.bot.telegram.setWebhook(webhookUrl);
      logger.success(`Webhook set to: ${webhookUrl}`);

      // Use secretPathComponent for security
      app.use(this.bot.webhookCallback(webhookPath));

      // Start Express server
      app.listen(port, () => {
        logger.success(`✅ Webhook server is running on port ${port}!`);
        logger.info(`Webhook endpoint: ${webhookPath}`);
      });

      // Enable graceful stop
      process.once('SIGINT', () => this.stopWebhook('SIGINT'));
      process.once('SIGTERM', () => this.stopWebhook('SIGTERM'));

    } catch (error) {
      logger.error('Failed to start webhook bot:', error);
      throw error;
    }
  }

  /**
   * Stop the bot gracefully (polling mode)
   */
  private async stop(signal: string): Promise<void> {
    logger.info(`Received ${signal} - stopping bot gracefully...`);
    this.bot.stop(signal);
    logger.info('Bot stopped');
    process.exit(0);
  }

  /**
   * Stop the bot gracefully (webhook mode)
   */
  private async stopWebhook(signal: string): Promise<void> {
    logger.info(`Received ${signal} - stopping webhook bot gracefully...`);
    try {
      // Remove webhook
      await this.bot.telegram.deleteWebhook();
      logger.info('Webhook removed');
    } catch (error) {
      logger.error('Failed to remove webhook:', error);
    }
    this.bot.stop(signal);
    logger.info('Bot stopped');
    process.exit(0);
  }
}
