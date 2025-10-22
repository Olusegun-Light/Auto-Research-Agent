/**
 * Telegram Bot Handler - Processes user messages and coordinates research
 */

import { readFile } from 'fs/promises';
import { TelegramBotService, TelegramMessage } from '../services/telegramBotService.js';
import { AutoResearchAgent } from '../agents/AutoResearchAgent.js';
import { ResearchTopic } from '../types/index.js';
import { Logger } from '../utils/index.js';

const logger = new Logger('TelegramBotHandler');

interface UserSession {
  chatId: number;
  username?: string;
  awaitingTopic?: boolean;
  currentResearch?: {
    agent: AutoResearchAgent;
    topic: string;
    startTime: number;
  };
}

export class TelegramBotHandler {
  private botService: TelegramBotService;
  private sessions: Map<number, UserSession> = new Map();
  private lastUpdateId: number = 0;

  constructor() {
    this.botService = new TelegramBotService();
  }

  /**
   * Start the bot and listen for messages
   */
  async start(): Promise<void> {
    logger.info('Starting Telegram bot...');

    // Get bot info
    const botInfo = await this.botService.getMe();
    logger.success(`Bot started: @${botInfo.username}`);

    // Set bot commands
    await this.botService.setMyCommands([
      { command: 'start', description: 'Start the bot and see welcome message' },
      { command: 'research', description: 'Start a new research' },
      { command: 'help', description: 'Show help message' },
      { command: 'status', description: 'Check current research status' },
      { command: 'cancel', description: 'Cancel current research' },
    ]);

    // Start polling for updates
    await this.pollUpdates();
  }

  /**
   * Poll for updates from Telegram
   */
  private async pollUpdates(): Promise<void> {
    while (true) {
      try {
        const updates = await this.botService.getUpdates(this.lastUpdateId + 1);

        for (const update of updates) {
          this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
          
          if (update.message) {
            await this.handleMessage(update.message);
          }
        }
      } catch (error) {
        logger.error('Error polling updates:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
      }
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text?.trim();

    if (!text) return;

    logger.info(`Message from ${message.from.first_name} (${chatId}): ${text}`);

    // Get or create session
    let session = this.sessions.get(chatId);
    if (!session) {
      session = {
        chatId,
        username: message.from.username,
      };
      this.sessions.set(chatId, session);
    }

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(session, text);
      return;
    }

    // Handle topic input if awaiting
    if (session.awaitingTopic) {
      session.awaitingTopic = false;
      await this.startResearch(session, text);
      return;
    }

    // Default: treat as research topic
    await this.startResearch(session, text);
  }

  /**
   * Handle bot commands
   */
  private async handleCommand(session: UserSession, command: string): Promise<void> {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        await this.handleStart(session);
        break;

      case '/research':
        await this.handleResearchCommand(session);
        break;

      case '/help':
        await this.handleHelp(session);
        break;

      case '/status':
        await this.handleStatus(session);
        break;

      case '/cancel':
        await this.handleCancel(session);
        break;

      default:
        await this.botService.sendMessage(
          session.chatId,
          '❓ Unknown command. Use /help to see available commands.'
        );
    }
  }

  /**
   * Handle /start command
   */
  private async handleStart(session: UserSession): Promise<void> {
    const welcomeMessage = `
🧠 *Welcome to AutoResearch Agent!*

I'm an AI-powered research assistant that can:
• 🔍 Search multiple sources on the web
• 📄 Extract and analyze content
• 🤖 Synthesize findings using AI
• 📊 Generate comprehensive reports with citations
• 📥 Deliver results in Markdown and PDF formats

*How to use:*
1. Send me any research topic
2. Wait 2-3 minutes while I work
3. Receive your research report!

*Commands:*
/research - Start a new research
/help - Show help message
/status - Check research status
/cancel - Cancel current research

*Example topics:*
• "Artificial Intelligence in Healthcare"
• "Climate Change Impact on Agriculture"
• "Quantum Computing Applications"

Just send me a topic to get started! 🚀
    `.trim();

    await this.botService.sendMessage(session.chatId, welcomeMessage);
  }

  /**
   * Handle /research command
   */
  private async handleResearchCommand(session: UserSession): Promise<void> {
    if (session.currentResearch) {
      await this.botService.sendMessage(
        session.chatId,
        '⚠️ You already have a research in progress. Use /cancel to stop it first.'
      );
      return;
    }

    session.awaitingTopic = true;
    await this.botService.sendMessage(
      session.chatId,
      '📝 Please send me the research topic you want to explore.'
    );
  }

  /**
   * Handle /help command
   */
  private async handleHelp(session: UserSession): Promise<void> {
    const helpMessage = `
📚 *AutoResearch Agent Help*

*Quick Start:*
Simply send me any research topic, and I'll generate a comprehensive report!

*Commands:*
/start - Show welcome message
/research - Start a new research
/help - Show this help message
/status - Check current research status
/cancel - Cancel ongoing research

*Features:*
✅ Multi-source web search
✅ AI-powered analysis (GPT-4)
✅ Citation management
✅ Professional reports
✅ PDF and Markdown export

*Research Process:*
1. 🔍 Searching multiple sources
2. 📄 Extracting content
3. 🤖 Analyzing with AI
4. 📊 Generating report
5. 📥 Sending results

*Example Topics:*
• Technology: "Blockchain in Supply Chain"
• Science: "CRISPR Gene Editing"
• Business: "Remote Work Trends 2024"
• Health: "Mental Health Apps Effectiveness"

*Tips:*
• Be specific with your topic
• Research takes 2-5 minutes
• You'll receive both PDF and Markdown
• One research at a time per user

Need help? Just ask! 💡
    `.trim();

    await this.botService.sendMessage(session.chatId, helpMessage);
  }

  /**
   * Handle /status command
   */
  private async handleStatus(session: UserSession): Promise<void> {
    if (!session.currentResearch) {
      await this.botService.sendMessage(
        session.chatId,
        '✨ No research in progress. Send me a topic to start!'
      );
      return;
    }

    const { topic, startTime } = session.currentResearch;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    const statusMessage = `
📊 *Research Status*

*Topic:* ${topic}
*Status:* In Progress
*Elapsed:* ${elapsed}s

Please wait... 🔄
    `.trim();

    await this.botService.sendMessage(session.chatId, statusMessage);
  }

  /**
   * Handle /cancel command
   */
  private async handleCancel(session: UserSession): Promise<void> {
    if (!session.currentResearch) {
      await this.botService.sendMessage(
        session.chatId,
        '✨ No research in progress.'
      );
      return;
    }

    session.currentResearch = undefined;
    await this.botService.sendMessage(
      session.chatId,
      '❌ Research cancelled. Send a new topic to start again.'
    );
  }

  /**
   * Start research on a topic
   */
  private async startResearch(session: UserSession, topic: string): Promise<void> {
    if (session.currentResearch) {
      await this.botService.sendMessage(
        session.chatId,
        '⚠️ You already have a research in progress. Please wait or use /cancel.'
      );
      return;
    }

    // Validate topic length
    if (topic.length < 3) {
      await this.botService.sendMessage(
        session.chatId,
        '❌ Topic is too short. Please provide a more detailed topic.'
      );
      return;
    }

    if (topic.length > 200) {
      await this.botService.sendMessage(
        session.chatId,
        '❌ Topic is too long. Please keep it under 200 characters.'
      );
      return;
    }

    // Send typing indicator
    await this.botService.sendTypingAction(session.chatId);

    // Create agent and start research
    const agent = new AutoResearchAgent();
    session.currentResearch = {
      agent,
      topic,
      startTime: Date.now(),
    };

    // Send initial message
    await this.botService.sendMessage(
      session.chatId,
      `🚀 *Starting research on:* "${topic}"\n\nThis will take 1-3 minutes. I'll send you updates as I work!\n\nUse /status to check progress.`
    );

    // Run research in background
    this.executeResearch(session, topic, agent).catch(error => {
      logger.error('Research failed:', error);
    });
  }

  /**
   * Execute research and send results
   */
  private async executeResearch(session: UserSession, topic: string, agent: AutoResearchAgent): Promise<void> {
    try {
      // Send periodic status updates (with error handling)
      let updateCount = 0;
      const statusMessages = [
        '🔍 Searching for relevant sources...',
        '📄 Extracting content from web pages...',
        '🤖 Analyzing information with AI...',
        '📊 Generating comprehensive report...',
        '⏳ Almost done, finalizing your research...',
      ];
      
      const statusInterval = setInterval(async () => {
        try {
          await this.botService.sendTypingAction(session.chatId);
        } catch (error) {
          // Ignore typing action errors - non-critical
        }
        
        try {
          const messageIndex = Math.min(updateCount, statusMessages.length - 1);
          await this.botService.sendMessage(
            session.chatId,
            statusMessages[messageIndex],
            { parse_mode: undefined }
          );
          updateCount++;
        } catch (error) {
          logger.warn('Failed to send status update (will retry next interval)');
        }
      }, 15000); // Every 15 seconds (reduced from 30)

      // Execute research with optimized settings for Telegram
      const researchTopic: ResearchTopic = {
        topic,
        depth: 'basic', // Use basic depth for faster results
        maxSources: 5, // Reduced from 10 to 5 for faster processing
        includeVisualization: false,
        outputFormats: ['markdown', 'pdf'],
      };

      // Add timeout wrapper (3 minutes max)
      const researchPromise = agent.research(researchTopic);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Research timeout - taking too long')), 180000); // 3 minutes
      });

      const outputPaths = await Promise.race([researchPromise, timeoutPromise]);
      
      clearInterval(statusInterval);

      // Clear current research
      session.currentResearch = undefined;

      // Send completion message
      await this.botService.sendMessage(
        session.chatId,
        `✅ *Research Complete!*\n\nTopic: "${topic}"\n\nSending your reports now...`
      );

      // Send files
      for (const path of outputPaths) {
        try {
          const fileBuffer = await readFile(path);
          const filename = path.split('/').pop() || 'report';
          
          await this.botService.sendDocument(
            session.chatId,
            fileBuffer,
            filename,
            `Research report: ${topic}`
          );
        } catch (error) {
          logger.error(`Failed to send file ${path}:`, error);
        }
      }

      // Send final message
      await this.botService.sendMessage(
        session.chatId,
        `
🎉 *All done!*

Your research on "${topic}" is complete. I've sent you:
• 📝 Markdown report (for editing)
• 📄 PDF report (for sharing)

Both include citations and structured sections.

Ready for another research? Just send me a new topic! 🚀
        `.trim()
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Research failed:', error);

      session.currentResearch = undefined;

      await this.botService.sendMessage(
        session.chatId,
        `❌ *Research Failed*\n\nSorry, something went wrong:\n${errorMessage}\n\nPlease try again with a different topic.`
      );
    }
  }
}
