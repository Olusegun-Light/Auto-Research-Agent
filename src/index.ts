/**
 * Main entry point for the AutoResearch Agent
 */

import { AutoResearchAgent } from './agents/AutoResearchAgent.js';
import { ResearchTopic } from './types/index.js';
import { Logger } from './utils/index.js';
import { config } from './config/index.js';
import * as readline from 'readline';

const logger = new Logger('Main');

/**
 * Interactive mode - prompts user for research topic
 */
async function interactiveMode(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise(resolve => {
      rl.question(prompt, resolve);
    });
  };

  console.log('\n🧠 AutoResearch Agent - Interactive Mode\n');
  console.log('═'.repeat(50));

  const topic = await question('\nEnter research topic: ');
  
  if (!topic.trim()) {
    console.log('❌ Topic cannot be empty');
    rl.close();
    return;
  }

  const depthInput = await question('\nResearch depth (basic/intermediate/comprehensive) [intermediate]: ');
  const depth = (depthInput.trim() || 'intermediate') as 'basic' | 'intermediate' | 'comprehensive';

  const maxSourcesInput = await question(`\nMaximum sources (1-50) [${config.maxSearchResults}]: `);
  const maxSources = parseInt(maxSourcesInput) || config.maxSearchResults;

  const vizInput = await question('\nInclude data visualizations? (y/n) [n]: ');
  const includeVisualization = vizInput.toLowerCase() === 'y';

  rl.close();

  console.log('\n' + '═'.repeat(50));
  console.log('\n🚀 Starting research...\n');

  const researchTopic: ResearchTopic = {
    topic,
    depth,
    maxSources: Math.min(Math.max(maxSources, 1), 50),
    includeVisualization,
    outputFormats: config.reportFormats,
  };

  await runResearch(researchTopic);
}

/**
 * Programmatic mode - uses predefined research topic
 */
async function programmaticMode(topic: string): Promise<void> {
  console.log('\n🧠 AutoResearch Agent - Programmatic Mode\n');
  console.log('═'.repeat(50));

  const researchTopic: ResearchTopic = {
    topic,
    depth: 'intermediate',
    maxSources: config.maxSearchResults,
    includeVisualization: false,
    outputFormats: config.reportFormats,
  };

  await runResearch(researchTopic);
}

/**
 * Execute research with given topic
 */
async function runResearch(researchTopic: ResearchTopic): Promise<void> {
  const agent = new AutoResearchAgent();

  try {
    logger.info('Starting research workflow...');

    // Execute research
    const outputPaths = await agent.research(researchTopic);

    // Display results
    console.log('\n' + '═'.repeat(50));
    console.log('\n✅ Research Complete!\n');
    console.log('📄 Generated Reports:');
    outputPaths.forEach((path, idx) => {
      console.log(`   ${idx + 1}. ${path}`);
    });
    console.log('\n' + '═'.repeat(50) + '\n');

  } catch (error) {
    logger.error('Research failed:', error);
    process.exit(1);
  }
}

/**
 * Display usage information
 */
function displayUsage(): void {
  console.log(`
🧠 AutoResearch Agent - Usage

Interactive Mode:
  npm run dev
  node dist/index.js

Programmatic Mode:
  npm run dev -- "Your research topic"
  node dist/index.js "Your research topic"

Examples:
  npm run dev
  npm run dev -- "Artificial Intelligence in Healthcare"
  npm run dev -- "Climate Change Impact on Agriculture"

Configuration:
  Edit .env file to configure API keys and settings
  See .env.example for available options
`);
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
      displayUsage();
      return;
    }

    // Display configuration info
    console.log('\n⚙️  Configuration:');
    console.log(`   Output Directory: ${config.outputDir}`);
    console.log(`   Report Formats: ${config.reportFormats.join(', ')}`);
    console.log(`   Max Search Results: ${config.maxSearchResults}`);
    console.log('');

    // Check if topic provided as argument
    if (args.length > 0) {
      const topic = args.join(' ');
      await programmaticMode(topic);
    } else {
      await interactiveMode();
    }

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
