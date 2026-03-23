/**
 * Chat ID Extractor
 * 
 * Extracts Telegram chat ID from various sources (MCP context, tool arguments, etc.)
 */

import { Logger } from './index.js';

const logger = new Logger('ChatIdExtractor');

// Global storage for the current chat ID
let currentChatId: number | null = null;

/**
 * Set the current chat ID
 */
export function setCurrentChatId(chatId: number): void {
  currentChatId = chatId;
  logger.info(`Chat ID set to: ${chatId}`);
}

/**
 * Get the current chat ID
 */
export function getCurrentChatId(): number | null {
  return currentChatId;
}

/**
 * Extract chat ID from MCP message or context
 * MCP Telegram messages contain chat information
 */
export function extractChatIdFromContext(context: any): number | null {
  try {
    // Try different paths where chat ID might be
    if (context?.chat_id) {
      return context.chat_id;
    }
    
    if (context?.chat?.id) {
      return context.chat.id;
    }
    
    if (context?.message?.chat?.id) {
      return context.message.chat.id;
    }
    
    if (context?.from?.id) {
      return context.from.id;
    }
    
    return null;
  } catch (error) {
    logger.error('Error extracting chat ID:', error);
    return null;
  }
}

/**
 * Clear the current chat ID
 */
export function clearCurrentChatId(): void {
  currentChatId = null;
  logger.info('Chat ID cleared');
}
