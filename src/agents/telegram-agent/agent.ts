/**
 * Telegram Agent
 * 
 * Creates and configures a Telegram agent with MCP tools for Telegram interactions.
 * This agent is invisible to users - it handles the MCP communication layer.
 * The root agent (ResearchAgent) is what users actually interact with.
 */

import { LlmAgent, type SamplingHandler } from '@iqai/adk';
import { config, getDefaultModel } from '../../config/index.js';
import { getTelegramMcpTools } from './tool.js';

/**
 * Get Telegram agent with MCP tools
 * 
 * This agent provides the Telegram MCP tools but doesn't process user requests directly.
 * It's used by the sampling handler to enable bi-directional communication.
 * 
 * @param samplingHandler - The sampling handler that enables Telegram MCP communication
 * @returns A configured LlmAgent instance with Telegram interaction capabilities
 */
export const getTelegramAgent = async (samplingHandler: SamplingHandler) => {
  const telegramMcpTools = await getTelegramMcpTools(samplingHandler);
  
  const telegramAgent = new LlmAgent({
    name: 'telegram_agent',
    description:
      'An agent capable of interacting with Telegram. It can send messages, get channel information, forward messages, pin messages, and manage Telegram chats.',
    model: getDefaultModel(config),
    tools: telegramMcpTools,
  });
  
  return telegramAgent;
};
