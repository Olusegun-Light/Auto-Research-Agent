/**
 * Test script for Topic Extraction Agent
 * 
 * Tests the ADK-TS TopicExtractorAgent with various input patterns
 */

import { extractCleanTopic } from './src/agents/specialized/index.js';
import { config, getDefaultModel } from './src/config/index.js';

const testCases = [
  'i want to do research on the effects of dams in the community',
  'Can you research Artificial Intelligence in Healthcare for me?',
  'Please tell me about climate change effects on agriculture',
  'Research quantum computing applications',
  "I'm curious about machine learning, can you help?",
  'Could you find information about renewable energy sources please?',
  'effects of social media on mental health',
  'tell me about blockchain technology',
];

async function runTests() {
  console.log('\n🧪 Testing ADK-TS Topic Extraction Agent\n');
  console.log('='.repeat(80));
  
  const model = getDefaultModel(config);
  console.log(`Using model: ${model}\n`);

  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Input:  "${testCase}"`);
      const cleanTopic = await extractCleanTopic(testCase, model);
      console.log(`✅ Output: "${cleanTopic}"`);
    } catch (error) {
      console.error(`❌ Error: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Topic extraction test complete!\n');
}

runTests().catch(console.error);
