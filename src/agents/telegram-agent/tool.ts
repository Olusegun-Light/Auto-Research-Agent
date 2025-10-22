/**
 * Telegram MCP Tools
 * 
 * Initializes and retrieves Telegram MCP (Model Context Protocol) tools.
 * This enables the agent to perform Telegram operations like sending messages,
 * managing chats, and interacting with Telegram's Bot API through the MCP interface.
 */

import { McpTelegram, type SamplingHandler } from '@iqai/adk';
import { config } from '../../config/index.js';

/**
 * Get Telegram MCP tools with sampling handler
 * 
 * @param samplingHandler - Handler for processing MCP sampling requests
 * @returns Promise resolving to an array of Telegram MCP tools for agent use
 */
export const getTelegramMcpTools = async (samplingHandler: SamplingHandler) => {
  const mcpToolset = McpTelegram({
    samplingHandler,
    env: {
      TELEGRAM_BOT_TOKEN: config.telegramBotToken || '',
    },
  });
  
  const tools = await mcpToolset.getTools();
  return tools;
};
