/**
 * Research Tool - ADK-TS tool for conducting research with Telegram file delivery
 * 
 * Works like the CLI but also sends files directly to Telegram after completion.
 */

import { BaseTool } from '@iqai/adk';
import { AutoResearchAgent } from '../agents/AutoResearchAgent.js';
import type { ResearchTopic } from '../types/index.js';
import { Logger } from '../utils/index.js';
import type { TelegramFileService } from '../services/telegramFileService.js';

const logger = new Logger('ResearchTool');

// Global reference to the Telegram file service (set by telegram-bot.ts)
let telegramFileService: TelegramFileService | null = null;

export function setTelegramFileService(service: TelegramFileService): void {
  telegramFileService = service;
  logger.info('Telegram file service connected to research tool');
}

export class ResearchTool extends BaseTool {
  constructor() {
    super({
      name: 'conduct_research',
      description: 'Execute comprehensive research on a topic and generate detailed reports (PDF + Markdown). Takes 2-3 minutes to complete.'
    });
  }

  async execute(args: { 
    topic: string; 
    depth?: 'basic' | 'intermediate' | 'comprehensive'; 
    maxSources?: number;
    chatId?: number;
  }) {
    try {
      logger.info(`Starting research on: ${args.topic}`);
      
      // Create research agent (exactly like CLI does)
      const agent = new AutoResearchAgent();
      
      // Configure research topic
      const researchTopic: ResearchTopic = {
        topic: args.topic,
        depth: args.depth || 'intermediate',
        maxSources: args.maxSources || 5,
        includeVisualization: false
      };

      // Execute research (exactly like CLI does)
      const outputPaths = await agent.research(researchTopic);
      
      logger.success(`Research complete! Generated ${outputPaths.length} file(s)`);
      
      // Send files directly to Telegram (independent of MCP)
      if (telegramFileService) {
        logger.info('Sending files to Telegram...');
        
        // If chatId provided, use it
        if (args.chatId) {
          telegramFileService.setChatId(args.chatId);
        }
        
        // Send the research completion with files
        await telegramFileService.sendResearchComplete(
          args.topic,
          outputPaths,
          args.chatId
        );
        
        logger.success('Files sent to Telegram successfully!');
      } else {
        logger.warn('Telegram file service not available - files saved locally only');
      }
      
      // Format success message
      const fileList = outputPaths.map((path, idx) => {
        const isPDF = path.endsWith('.pdf');
        const icon = isPDF ? '📄' : '📝';
        const type = isPDF ? 'PDF Report' : 'Markdown Report';
        return `${idx + 1}. ${icon} ${type}\n   ${path}`;
      }).join('\n\n');

      return {
        success: true,
        topic: args.topic,
        outputPaths: outputPaths,
        summary: `✅ Research complete on "${args.topic}"!\n\n📊 Generated ${outputPaths.length} comprehensive report(s):\n\n${fileList}\n\n📤 Files have been sent to your Telegram chat!\n\n💡 Ready for another research topic?`
      };
      
    } catch (error) {
      logger.error('Research failed:', error);
      
      return {
        success: false,
        topic: args.topic,
        error: error instanceof Error ? error.message : 'Unknown error',
        summary: `❌ Research failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or use a different topic.`
      };
    }
  }
}

export const researchTool = new ResearchTool();
