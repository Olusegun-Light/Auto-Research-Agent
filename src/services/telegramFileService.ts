/**
 * Telegram File Service
 * 
 * Handles direct file uploads to Telegram using the Bot API.
 * This service sends the generated research reports (PDF + Markdown) 
 * directly to the user's chat, independent of the MCP conversation layer.
 */

import { Telegraf } from 'telegraf';
import { Logger } from '../utils/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { Input } from 'telegraf';

const logger = new Logger('TelegramFileService');

export class TelegramFileService {
  private bot: Telegraf;
  private chatId: number | null = null;

  constructor(botToken: string, defaultChatId?: string) {
    this.bot = new Telegraf(botToken);
    
    // Set default chat ID if provided (from env variable)
    if (defaultChatId) {
      const parsedId = parseInt(defaultChatId);
      if (!isNaN(parsedId)) {
        this.chatId = parsedId;
        logger.info(`Default chat ID set to: ${parsedId}`);
      }
    }
  }

  /**
   * Initialize the bot (NO polling - MCP handles messages)
   * We only use this bot instance for SENDING files, not receiving messages
   */
  async initialize(): Promise<void> {
    try {
      // Just verify the token is valid by checking bot info
      // Use a short timeout to avoid blocking bot startup
      const botInfo = await Promise.race([
        this.bot.telegram.getMe(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
      ]);
      
      if (botInfo) {
        logger.success(`Telegram file service initialized for bot: @${(botInfo as any).username}`);
        logger.info('File service is ready to send files (MCP handles incoming messages)');
      }
    } catch (error) {
      // Don't fail startup if file service can't connect
      // Bot will still work for conversation, just can't send files
      logger.warn('Could not verify Telegram file service - file delivery may not work');
      logger.warn('Bot will still respond to messages via MCP');
      logger.info('To fix: Check network connection or TELEGRAM_BOT_TOKEN');
    }
  }

  /**
   * Set the chat ID manually (extracted from MCP messages)
   */
  setChatId(chatId: number): void {
    this.chatId = chatId;
    logger.info(`Chat ID set to: ${chatId}`);
  }

  /**
   * Send a text message to the user
   */
  async sendMessage(message: string, chatId?: number): Promise<void> {
    const targetChatId = chatId || this.chatId;
    if (!targetChatId) {
      logger.warn('Cannot send message - no chat ID available');
      return;
    }

    try {
      await this.bot.telegram.sendMessage(targetChatId, message, {
        parse_mode: 'Markdown'
      });
      logger.success(`Message sent to chat ${targetChatId}`);
    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  }

  /**
   * Send files to Telegram chat
   * 
   * @param filePaths - Array of file paths to send
   * @param chatId - Optional chat ID, uses stored ID if not provided
   * @param caption - Optional caption for the files
   */
  async sendFiles(filePaths: string[], chatId?: number, caption?: string): Promise<void> {
    const targetChatId = chatId || this.chatId;
    
    if (!targetChatId) {
      logger.warn('⚠️ Cannot send files - no chat ID available');
      logger.warn('💡 Files are saved locally at:', filePaths);
      logger.info('💡 To enable file delivery, the bot needs the chat ID from MCP');
      return;
    }

    for (const filePath of filePaths) {
      try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          logger.error(`File not found: ${filePath}`);
          continue;
        }

        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        
        logger.info(`Sending ${fileName} to chat ${targetChatId}...`);

        // Send different file types appropriately
        if (fileExtension === '.pdf') {
          // Send PDF as document
          await this.bot.telegram.sendDocument(
            targetChatId,
            Input.fromLocalFile(filePath),
            {
              caption: caption || `📄 ${fileName}`,
              parse_mode: 'Markdown'
            }
          );
        } else if (fileExtension === '.md' || fileExtension === '.markdown') {
          // Send Markdown as document
          await this.bot.telegram.sendDocument(
            targetChatId,
            Input.fromLocalFile(filePath),
            {
              caption: caption || `📝 ${fileName}`,
              parse_mode: 'Markdown'
            }
          );
        } else {
          // Send other files as generic documents
          await this.bot.telegram.sendDocument(
            targetChatId,
            Input.fromLocalFile(filePath),
            {
              caption: caption || fileName
            }
          );
        }

        logger.success(`✅ Sent ${fileName} successfully`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.error(`Failed to send ${filePath}:`, error);
        
        // If rate limited, wait longer
        if (error instanceof Error && error.message.includes('429')) {
          logger.warn('Rate limited - waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }

  /**
   * Send research completion notification with files
   */
  async sendResearchComplete(topic: string, filePaths: string[], chatId?: number): Promise<void> {
    const targetChatId = chatId || this.chatId;
    
    if (!targetChatId) {
      logger.warn('Cannot send research completion - no chat ID available');
      return;
    }

    try {
      // Send completion message
      const message = `🎉 *Research Complete!*\n\n📊 Topic: ${topic}\n📁 Generated ${filePaths.length} report(s)\n\n⬇️ Downloading files...`;
      await this.sendMessage(message, targetChatId);

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send each file
      await this.sendFiles(filePaths, targetChatId);

      // Send final message
      const finalMessage = `✅ All reports delivered!\n\n💡 Ready for another research topic?`;
      await this.sendMessage(finalMessage, targetChatId);

    } catch (error) {
      logger.error('Failed to send research completion:', error);
    }
  }

  /**
   * Gracefully shutdown the bot
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Telegram file service...');
    // Nothing to stop - we're not polling for messages
  }
}
