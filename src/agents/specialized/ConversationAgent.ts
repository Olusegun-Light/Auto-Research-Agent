/**
 * Conversation Agent - Uses ADK-TS to handle casual conversations
 * 
 * This agent provides friendly, contextual responses to non-research messages
 */

import { LlmAgent, AgentBuilder } from '@iqai/adk';
import { config, getDefaultModel } from '../../config/index.js';
import { Logger } from '../../utils/index.js';

const logger = new Logger('ConversationAgent');

/**
 * Create Conversation Agent using ADK-TS LlmAgent
 */
export function createConversationAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'conversation_agent',
    model,
    description: 'Handles casual conversations with users in a friendly, helpful manner',
    instruction: `
You are the conversation interface for AutoResearch Agent, an AI-powered research assistant.

YOUR PERSONALITY:
- Friendly and approachable
- Helpful and encouraging
- Professional but not robotic
- Concise (2-3 sentences max)

YOUR CAPABILITIES (to mention when relevant):
- Conduct comprehensive research on any topic
- Search multiple authoritative sources
- Generate professional PDF and Markdown reports
- Deliver results in minutes (2-3 minutes typical)

EXAMPLES OF GOOD RESPONSES:

User: "Hi"
Response: "Hello! 👋 I'm AutoResearch Agent, your AI research assistant. I can conduct comprehensive research on any topic and deliver professional reports in minutes. What would you like to research today?"

User: "How are you?"
Response: "I'm doing great, thanks for asking! 🤖 I'm always ready to help with research. Do you have a topic you'd like me to investigate?"

User: "What can you do?"
Response: "I conduct in-depth research on any topic! I search multiple sources, analyze the information with AI, and generate professional PDF and Markdown reports. Just tell me what you want to research, like 'Research Artificial Intelligence' or 'Tell me about Climate Change'."

User: "Thanks!"
Response: "You're very welcome! 😊 Feel free to ask me to research anything else whenever you need it."

User: "That's cool"
Response: "Glad you think so! Want to try it out? Just send me any topic you're curious about, and I'll get you a comprehensive report in a few minutes."

**RULES:**
- Keep responses SHORT (2-3 sentences)
- Use emojis sparingly (1-2 per response)
- Always be encouraging about research capabilities
- If user seems interested, suggest trying a research topic
- Don't be overly technical in casual conversation
- Sound natural and conversational

Extract the conversational response from the user's message and respond appropriately.
    `,
    outputKey: 'response',
    generateContentConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
    },
  });
}

/**
 * Generate a conversational response to user message
 */
export async function generateConversationResponse(
  userMessage: string
): Promise<string> {
  try {
    logger.info(`Generating conversation response for: "${userMessage}"`);

    const model = getDefaultModel(config);
    const conversationAgent = createConversationAgent(model);
    
    const { runner } = await AgentBuilder
      .create('conversationAgent')
      .withAgent(conversationAgent)
      .build();
    
    const prompt = `User message: "${userMessage}"`;
    const response = await runner.ask(prompt);

    logger.info(`Generated response: "${response}"`);
    return response.trim();

  } catch (error) {
    logger.error('Conversation generation failed:', error);
    
    // Fallback to simple response
    return fallbackConversationResponse(userMessage);
  }
}

/**
 * Fallback conversation response using simple heuristics
 */
function fallbackConversationResponse(userMessage: string): string {
  const messageLower = userMessage.toLowerCase().trim();

  // Greetings
  if (messageLower.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return `Hello! 👋 I'm AutoResearch Agent. I can research any topic and deliver professional reports. What would you like to research?`;
  }

  // How are you
  if (messageLower.match(/how are you|how're you/)) {
    return `I'm doing great! 🤖 Ready to help with research. What topic interests you?`;
  }

  // Thanks
  if (messageLower.match(/(thanks|thank you|thx)/)) {
    return `You're welcome! 😊 Feel free to ask me to research anything else!`;
  }

  // Goodbye
  if (messageLower.match(/(bye|goodbye|see you)/)) {
    return `Goodbye! 👋 Come back anytime you need research done!`;
  }

  // What can you do
  if (messageLower.match(/(what can you do|help|capabilities|features)/)) {
    return `I conduct comprehensive research! Just tell me a topic like "Research AI" or "Tell me about Climate Change" and I'll search multiple sources, analyze everything, and generate PDF + Markdown reports. Takes about 2-3 minutes!`;
  }

  // Affirmations
  if (messageLower.match(/^(yes|yeah|yep|sure|ok|okay)$/)) {
    return `Great! What topic would you like me to research? Try something like "Artificial Intelligence" or "Climate Change"!`;
  }

  // Default
  return `I'm not sure what you'd like me to do. 🤔 I specialize in research! Try saying "Research [topic]" or "Tell me about [topic]" and I'll create a comprehensive report for you!`;
}
