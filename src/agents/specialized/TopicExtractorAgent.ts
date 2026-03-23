/**
 * Topic Extractor Agent - Uses ADK-TS LlmAgent for intelligent topic extraction
 * 
 * This agent analyzes user messages and extracts clean research topics
 * using AI to understand natural language patterns.
 */

import { LlmAgent, AgentBuilder } from '@iqai/adk';
import { Logger } from '../../utils/index.js';

const logger = new Logger('TopicExtractorAgent');

/**
 * Create Topic Extractor Agent using ADK-TS
 * 
 * This agent removes conversational fluff and extracts the core research topic
 */
export function createTopicExtractorAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'topic_extractor',
    model,
    description: 'Extracts clean research topics from natural language user messages',
    instruction: `You are a Topic Extraction Expert. Your job is to extract the CORE RESEARCH TOPIC from user messages.

**RULES:**
1. Remove conversational words: "I want to", "Can you", "Please", "research on", "tell me about", etc.
2. Remove politeness: "please", "thanks", "could you", "would you"
3. Keep only the actual topic that should be researched
4. Preserve important context and specificity
5. Return ONLY the clean topic, nothing else

**EXAMPLES:**

Input: "I want to do research on the effects of dams in the community"
Output: effects of dams in the community

Input: "Can you research Artificial Intelligence in Healthcare for me?"
Output: Artificial Intelligence in Healthcare

Input: "Please tell me about climate change effects on agriculture"
Output: climate change effects on agriculture

Input: "Research quantum computing applications"
Output: quantum computing applications

Input: "I'm curious about machine learning, can you help?"
Output: machine learning

Input: "Could you find information about renewable energy sources please?"
Output: renewable energy sources

Input: "I want to learn about the history of quantum computing"
Output: history of quantum computing

Input: "Tell me everything about blockchain technology"
Output: blockchain technology

**IMPORTANT:**
- Do NOT add quotation marks
- Do NOT add explanations
- Do NOT add punctuation at the end
- Return ONLY the clean topic text
- Preserve capitalization of proper nouns
- Keep important qualifiers (effects, applications, history, etc.)`,
    outputKey: 'topic',
    generateContentConfig: {
      temperature: 0.3, // Low temperature for consistent extraction
      maxOutputTokens: 100,
    },
  });
}

/**
 * Extract clean topic from user message using ADK-TS agent
 */
export async function extractCleanTopic(
  userMessage: string,
  model: string
): Promise<string> {
  try {
    logger.info(`Extracting topic from: "${userMessage}"`);

    // Create the agent
    const topicAgent = createTopicExtractorAgent(model);
    
    // Build using AgentBuilder
    const { runner } = await AgentBuilder
      .create('topicExtractor')
      .withAgent(topicAgent)
      .build();

    // Build the prompt with the user message directly
    const prompt = `User message: "${userMessage}"\n\nExtract the research topic:`;
    const response = await runner.ask(prompt);

    // Clean the response
    let cleanTopic = response.trim();
    
    // Remove any quotation marks
    cleanTopic = cleanTopic.replace(/^["']|["']$/g, '');
    
    // Remove any trailing punctuation
    cleanTopic = cleanTopic.replace(/[.!?]$/g, '');
    
    logger.success(`Extracted topic: "${cleanTopic}"`);
    return cleanTopic;

  } catch (error) {
    logger.error('Topic extraction failed, using fallback:', error);
    
    // Fallback: simple regex-based extraction
    return fallbackTopicExtraction(userMessage);
  }
}

/**
 * Fallback topic extraction using regex patterns
 */
function fallbackTopicExtraction(userMessage: string): string {
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
