/**
 * Example: Running AutoResearch Agent programmatically
 */

import { AutoResearchAgent } from './agents/AutoResearchAgent.js';
import { ResearchTopic } from './types/index.js';

async function example1_BasicResearch() {
  console.log('\n📚 Example 1: Basic Research\n');
  
  const agent = new AutoResearchAgent();
  
  const topic: ResearchTopic = {
    topic: 'Benefits of Renewable Energy',
    depth: 'basic',
    maxSources: 5,
    includeVisualization: false,
  };
  
  const reports = await agent.research(topic);
  console.log('\n✅ Generated reports:', reports);
}

async function example2_ComprehensiveResearch() {
  console.log('\n📚 Example 2: Comprehensive Research with Visualizations\n');
  
  const agent = new AutoResearchAgent();
  
  const topic: ResearchTopic = {
    topic: 'Impact of Artificial Intelligence on Healthcare',
    depth: 'comprehensive',
    maxSources: 15,
    includeVisualization: true,
    outputFormats: ['markdown', 'pdf'],
  };
  
  const reports = await agent.research(topic);
  console.log('\n✅ Generated reports:', reports);
}

async function example3_MonitoringProgress() {
  console.log('\n📚 Example 3: Monitoring Research Progress\n');
  
  const agent = new AutoResearchAgent();
  
  const topic: ResearchTopic = {
    topic: 'Quantum Computing Applications',
    depth: 'intermediate',
    maxSources: 10,
  };
  
  try {
    console.log('Starting research...');
    const reports = await agent.research(topic);
    console.log('\n✅ Research complete!');
    console.log('📄 Generated reports:', reports);
  } catch (error) {
    console.error('❌ Research failed:', error);
  }
}

async function example4_CustomConfiguration() {
  console.log('\n📚 Example 4: Custom Configuration\n');
  
  const agent = new AutoResearchAgent();
  
  const topic: ResearchTopic = {
    topic: 'Blockchain Technology in Supply Chain',
    depth: 'intermediate',
    maxSources: 8,
    includeVisualization: true,
    outputFormats: ['markdown'], // Only markdown
  };
  
  console.log('Starting research with custom config...');
  const reports = await agent.research(topic);
  
  console.log('\n✅ Reports:', reports);
  console.log('\n📊 Research complete with', reports.length, 'report(s) generated');
}

// Main execution
async function runExamples() {
  console.log('🚀 AutoResearch Agent - Examples\n');
  console.log('='.repeat(60));
  
  try {
    // Choose which example to run
    const exampleNumber = process.argv[2] || '1';
    
    switch (exampleNumber) {
      case '1':
        await example1_BasicResearch();
        break;
      case '2':
        await example2_ComprehensiveResearch();
        break;
      case '3':
        await example3_MonitoringProgress();
        break;
      case '4':
        await example4_CustomConfiguration();
        break;
      case 'all':
        await example1_BasicResearch();
        await example2_ComprehensiveResearch();
        await example3_MonitoringProgress();
        await example4_CustomConfiguration();
        break;
      default:
        console.log('Unknown example. Choose 1, 2, 3, 4, or all');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Examples completed successfully!\n');
    
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}
