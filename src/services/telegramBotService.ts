/**
 * Telegram Bot Service - Interface for Telegram Bot API
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { Logger } from '../utils/index.js';
import { HttpsProxyAgent } from 'https-proxy-agent';

const logger = new Logger('TelegramBot');

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export class TelegramBotService {
  private botToken: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;
  private maxRetries: number = 3;
  private retryDelay: number = 2000;

  constructor() {
    if (!config.telegramBotToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    this.botToken = config.telegramBotToken;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    // Create axios instance with custom configuration
    const axiosConfig: any = {
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Check if proxy is configured
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
    if (proxyUrl) {
      logger.info(`Using proxy: ${proxyUrl}`);
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
      axiosConfig.proxy = false; // Disable axios default proxy handling
    }

    this.axiosInstance = axios.create(axiosConfig);
  }

  /**
   * Retry logic for failed requests
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries > 0 && this.isRetryableError(error)) {
        logger.warn(`Request failed, retrying... (${retries} attempts left)`);
        await this.sleep(this.retryDelay);
        return this.retryRequest(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    return (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENETUNREACH' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a text message to a chat
   */
  async sendMessage(chatId: number, text: string, options?: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_to_message_id?: number;
  }): Promise<void> {
    return this.retryRequest(async () => {
      try {
        await this.axiosInstance.post(`${this.baseUrl}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: options?.parse_mode || 'Markdown',
          reply_to_message_id: options?.reply_to_message_id,
        });
        logger.info(`Message sent to chat ${chatId}`);
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
          logger.error(`Network error sending message: ${error.message}. Check your internet connection or proxy settings.`);
        }
        throw error;
      }
    });
  }

  /**
   * Send a document to a chat
   */
  async sendDocument(chatId: number, document: Buffer, filename: string, caption?: string): Promise<void> {
    return this.retryRequest(async () => {
      try {
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        
        form.append('chat_id', chatId.toString());
        form.append('document', document, {
          filename,
          contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'text/markdown',
        });
        
        if (caption) {
          form.append('caption', caption);
        }

        await this.axiosInstance.post(`${this.baseUrl}/sendDocument`, form, {
          headers: form.getHeaders(),
          timeout: 60000, // 60 seconds for file uploads
        });
        
        logger.info(`Document sent to chat ${chatId}: ${filename}`);
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
          logger.error(`Network error sending document: ${error.message}`);
        }
        throw error;
      }
    });
  }

  /**
   * Send typing action to show bot is working
   */
  async sendTypingAction(chatId: number): Promise<void> {
    try {
      await this.axiosInstance.post(`${this.baseUrl}/sendChatAction`, {
        chat_id: chatId,
        action: 'typing',
      });
    } catch (error: any) {
      // Don't retry typing action, just log and ignore
      if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
        logger.debug('Network timeout for typing action (non-critical)');
      } else {
        logger.warn('Failed to send typing action:', error.message || error);
      }
    }
  }

  /**
   * Get updates from Telegram
   */
  async getUpdates(offset?: number, timeout: number = 30): Promise<TelegramUpdate[]> {
    return this.retryRequest(async () => {
      try {
        const response = await this.axiosInstance.get(`${this.baseUrl}/getUpdates`, {
          params: {
            offset,
            timeout,
            allowed_updates: JSON.stringify(['message']),
          },
          timeout: (timeout + 5) * 1000, // Add 5 seconds buffer
        });

        return response.data.result || [];
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
          logger.error(`Network error getting updates: ${error.message}`);
        } else {
          logger.error('Failed to get updates:', error.message || error);
        }
        return [];
      }
    });
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<any> {
    return this.retryRequest(async () => {
      try {
        const response = await this.axiosInstance.get(`${this.baseUrl}/getMe`);
        return response.data.result;
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
          logger.error(`Network error getting bot info: ${error.message}`);
        }
        throw error;
      }
    });
  }

  /**
   * Set bot commands (shown in menu)
   */
  async setMyCommands(commands: Array<{ command: string; description: string }>): Promise<void> {
    return this.retryRequest(async () => {
      try {
        await this.axiosInstance.post(`${this.baseUrl}/setMyCommands`, {
          commands,
        });
        logger.success('Bot commands updated');
      } catch (error: any) {
        if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH') {
          logger.error(`Network error setting commands: ${error.message}`);
        } else {
          logger.error('Failed to set commands:', error.message || error);
        }
      }
    });
  }
}
