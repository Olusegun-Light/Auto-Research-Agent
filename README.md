# AutoResearch Agent

> 🏆 **ADK-TS Hackathon 2025 Submission**

An intelligent, autonomous research agent powered by **ADK-TS** (AI Development Kit for TypeScript) that conducts comprehensive academic research on any topic. The agent searches multiple sources, extracts content, synthesizes findings using AI, and generates professional research reports in PDF and Markdown formats.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3.0-blue.svg)
![ADK-TS](https://img.shields.io/badge/ADK--TS-0.5.0-orange.svg)

## 🏆 Hackathon Submission

**Built for**: ADK-TS Hackathon 2025  
**Category**: Agent Applications  
**Live Demo**: [Try the Telegram Bot](https://t.me/autosearchagentbot) 🤖

This project demonstrates advanced ADK-TS patterns including:
- ✅ Multi-agent orchestration with `LlmAgent` and `AgentBuilder`
- ✅ Specialized agents for different research tasks
- ✅ Multi-provider support (GPT-4, Claude, Gemini)
- ✅ Hybrid architecture combining ADK-TS with custom services
- ✅ Real-world application with CLI and Telegram bot interfaces

**Note**: I explored ADK-TS MCP Telegram integration but built a custom bot to enable file delivery (PDFs/Markdown) while maintaining the ADK-TS agent workflow.

## 📋 Table of Contents

- [Features](#-features)
- [How It Works](#-how-it-works)
- [System Architecture](#-system-architecture)
- [ADK-TS Implementation](#-adk-ts-implementation)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Technologies Used](#-technologies-used)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Capabilities

- 🤖 **Multi-Agent System**: Specialized ADK-TS agents for query generation, content analysis, and report writing
- 🔍 **Intelligent Search**: Generates diverse search queries and searches across multiple sources (Serper, Brave, Google)
- 📊 **AI-Powered Analysis**: Uses advanced LLMs (GPT-4, Claude, Gemini) to synthesize research findings
- 📄 **Professional Reports**: Generates academic-quality reports with proper citations in PDF and Markdown
- ⚡ **Real-time Progress**: Live updates on research progress through Telegram bot interface
- 🎯 **Flexible Depth**: Choose between basic (3 sources), intermediate (5 sources), or comprehensive (10+ sources) research
- 📱 **Telegram Integration**: Full-featured bot interface with interactive menus and direct file delivery
- 🔧 **Hybrid Architecture**: Combines ADK-TS agents with custom services for maximum flexibility

> **Hackathon Note**: I initially tried ADK-TS MCP Telegram for interactive messaging, but built a custom bot to add file delivery capabilities (PDFs and Markdown) while maintaining the ADK-TS multi-agent workflow.

### Research Workflow

1. **Query Generation**: AI generates diverse, targeted search queries
2. **Multi-Source Search**: Parallel searches across configured search APIs
3. **Content Extraction**: Intelligent web scraping with quality filtering
4. **AI Analysis**: Deep content analysis and synthesis using LLM agents
5. **Report Generation**: Structured academic reports with proper formatting
6. **Multi-Format Export**: PDF and Markdown output with full citations

## 🔄 How It Works

### Research Pipeline

```
User Input → Query Generation Agent → Search APIs → Content Extraction
    ↓                                                        ↓
Report Generation ← Content Analysis Agent ← Content Filtering
    ↓
PDF + Markdown Reports → User
```

### Step-by-Step Process

1. **Topic Input**: User provides a research topic via CLI or Telegram
2. **Query Generation**: ADK-TS `QueryGeneratorAgent` creates 3-10 diverse search queries
3. **Parallel Search**: Searches execute concurrently across multiple APIs
4. **Content Extraction**: Extracts and filters relevant content (minimum 50 words)
5. **AI Analysis**: `ContentAnalyzerAgent` synthesizes findings from all sources
6. **Report Generation**: `ReportGeneratorAgent` creates structured academic report
7. **Export**: Generates PDF and Markdown files with citations
8. **Delivery**: Files saved locally or sent via Telegram

## 🏗️ System Architecture

### Multi-Agent Architecture

The system uses ADK-TS to orchestrate multiple specialized agents:

```typescript
AutoResearchAgent (Orchestrator)
├── QueryGeneratorAgent     → Generates search queries
├── ContentAnalyzerAgent    → Analyzes extracted content
└── ReportGeneratorAgent    → Creates structured reports
```

### Component Overview

```
src/
├── agents/
│   ├── AutoResearchAgent.ts          # Main orchestrator
│   └── specialized/
│       ├── QueryGeneratorAgent.ts    # Search query generation
│       ├── ContentAnalyzerAgent.ts   # Content synthesis
│       ├── ReportGeneratorAgent.ts   # Report creation
│       └── TopicExtractorAgent.ts    # Topic extraction from text
├── bot/
│   └── telegramBot.ts               # Telegram bot implementation
├── services/
│   ├── searchService.ts             # Multi-API search
│   ├── contentExtractionService.ts  # Web scraping
│   ├── reportGenerationService.ts   # PDF/Markdown generation
│   └── aiService.ts                 # LLM interactions
├── tools/                           # ADK-TS tools (if needed)
├── types/                          # TypeScript interfaces
└── utils/                          # Helper functions
```

### Data Flow

1. **Input Layer**: CLI or Telegram Bot receives user request
2. **Agent Layer**: ADK-TS agents process and transform data
3. **Service Layer**: Specialized services handle API calls and data processing
4. **Output Layer**: Generated reports delivered to user

## 🧠 ADK-TS Implementation

### How ADK-TS Was Used for the Hackathon

This project was built **specifically for the ADK-TS Hackathon 2025** to showcase the power and flexibility of the ADK-TS framework. Here's how we leveraged ADK-TS throughout the development:

#### **1. Multi-Agent Architecture (Core Hackathon Feature)**

We designed a specialized multi-agent system where each agent has a focused responsibility:

**QueryGeneratorAgent** - Creates intelligent search queries
```typescript
import { LlmAgent } from '@iqai/adk';

export function createQueryGeneratorAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'query_generator',
    model: 'gemini-1.5-flash',  // Supports multiple providers
    description: 'Generates diverse search queries for research',
    instruction: `You are an expert research librarian...`,
    outputKey: 'search_queries',
    generateContentConfig: {
      temperature: 0.7,  // Balanced for creativity
      maxOutputTokens: 500,
    },
  });
}
```

**ContentAnalyzerAgent** - Synthesizes research findings
```typescript
export function createContentAnalyzerAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'content_analyzer',
    model,
    description: 'Analyzes and synthesizes research content',
    instruction: `You are an expert research analyst...`,
    outputKey: 'content_analysis',
    generateContentConfig: {
      temperature: 0.5,  // More focused for analysis
      maxOutputTokens: 2000,
    },
  });
}
```

**ReportGeneratorAgent** - Creates structured academic reports
```typescript
export function createReportGeneratorAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'report_generator',
    model,
    description: 'Generates comprehensive research reports',
    instruction: `You are an expert academic writer...`,
    outputKey: 'research_report',
    generateContentConfig: {
      temperature: 0.6,  // Professional writing tone
      maxOutputTokens: 4000,
    },
  });
}
```

#### **2. Agent Orchestration with AgentBuilder**

The `AutoResearchAgent` coordinates all specialized agents using ADK-TS patterns:

```typescript
import { AgentBuilder } from '@iqai/adk';

// Step 1: Generate search queries
const queryAgent = createQueryGeneratorAgent('gemini-1.5-flash');
const { runner: queryRunner } = await AgentBuilder
  .create('queryGenerator')
  .withAgent(queryAgent)
  .build();

const queries = await queryRunner.ask(queryPrompt);

// Step 2: Analyze content
const analyzerAgent = createContentAnalyzerAgent('gemini-1.5-flash');
const { runner: analyzerRunner } = await AgentBuilder
  .create('contentAnalyzer')
  .withAgent(analyzerAgent)
  .build();

const analysis = await analyzerRunner.ask(analysisPrompt);

// Step 3: Generate report
const reportAgent = createReportGeneratorAgent('gemini-1.5-flash');
const { runner: reportRunner } = await AgentBuilder
  .create('reportGenerator')
  .withAgent(reportAgent)
  .build();

const report = await reportRunner.ask(reportPrompt);
```

#### **3. CLI Implementation with ADK-TS**

The command-line interface leverages ADK-TS for intelligent interaction:

- **Interactive Mode**: Uses `readline` for input, then passes to ADK-TS agents
- **Agent Pipeline**: Each input goes through the multi-agent workflow
- **Streaming Results**: Progress updates as each agent completes its task
- **Error Recovery**: Graceful fallbacks when agents encounter issues

```typescript
// CLI workflow using ADK-TS agents
async function runResearch(topic: string): Promise<void> {
  const agent = new AutoResearchAgent();  // Orchestrator
  
  // ADK-TS agents handle each phase:
  // 1. QueryGeneratorAgent → search queries
  // 2. SearchService → fetch content
  // 3. ContentAnalyzerAgent → synthesize findings
  // 4. ReportGeneratorAgent → create report
  
  const outputPaths = await agent.research({ topic });
}
```

#### **4. Telegram Bot with ADK-TS Integration**

**Initial Approach**: I first tried the **ADK-TS MCP Telegram integration** for the hackathon, which provided excellent conversational capabilities and interactive messaging. However, we discovered a critical limitation: **MCP could send messages but not files** (PDFs and Markdown reports).

**Solution**: I built a **custom Telegram bot** using Telegraf that:
- Integrates with the same ADK-TS agents used in CLI
- Adds file delivery capabilities
- Maintains the multi-agent workflow
- Includes a specialized `TopicExtractorAgent` for natural language understanding

```typescript
// TopicExtractorAgent - Understands natural language requests
async extractResearchTopic(userMessage: string): Promise<string> {
  const model = getDefaultModel(config);
  const cleanTopic = await extractCleanTopic(userMessage, model);
  // Uses ADK-TS agent to parse: "I want to research AI in healthcare"
  // → "Artificial Intelligence in Healthcare"
}

// Then uses the same multi-agent system:
async executeResearch(topic: string): Promise<void> {
  this.researchAgent = new AutoResearchAgent(progressCallback);
  // Same agents: QueryGenerator → ContentAnalyzer → ReportGenerator
  const outputPaths = await this.researchAgent.research({ topic });
  
  // Custom code for file delivery (not available in MCP)
  await this.sendFiles(outputPaths);
}
```

#### **5. Key ADK-TS Features Demonstrated**

✅ **LlmAgent**: Created 4 specialized agents (Query, Analysis, Report, Topic Extraction)  
✅ **AgentBuilder**: Proper instantiation and runner creation for each agent  
✅ **Model Flexibility**: Support for GPT-4, Claude 3.5, and Gemini 1.5  
✅ **Prompt Engineering**: Structured prompts with clear instructions and output formats  
✅ **Error Handling**: Graceful fallbacks when agents timeout or fail  
✅ **JSON Outputs**: Structured data extraction from LLM responses  
✅ **Multi-Provider Support**: Automatic fallback between AI providers  
✅ **Temperature Control**: Fine-tuned creativity vs. precision for each agent  

#### **6. Hackathon Innovation: Hybrid Approach**

For this hackathon, we combined:
- **ADK-TS Agents**: Core intelligence and orchestration
- **Custom Services**: Search, content extraction, PDF generation
- **MCP Attempt**: Tried ADK-TS MCP Telegram (great for chat, limited for files)
- **Custom Bot**: Built on ADK-TS agents with file delivery capabilities

This demonstrates ADK-TS's flexibility - you can use the framework for core AI logic while adding custom functionality where needed.  

## 📦 Installation

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** or **yarn**
- API keys for at least one AI provider and one search API

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Olusegun-Light/Auto-Research-Agent.git
cd Auto-Research-Agent

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your API keys in .env (see Configuration section)
nano .env  # or use your preferred editor

# Build the project
npm run build

# Run in development mode
npm run dev

# Or start Telegram bot
npm run bot
```

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run Telegram bot in development
npm run telegram-bot

# Build for production
npm run build

# Run production build
npm start

# Run production Telegram bot
npm run bot:prod
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root with the following configuration:

```bash
# ============================================
# AI PROVIDERS (At least ONE required)
# ============================================

# OpenAI (GPT-4)
OPENAI_API_KEY=sk-proj-...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini) - Recommended for free tier
GEMINI_API_KEY=AIza...

# ============================================
# SEARCH APIS (At least ONE required)
# ============================================

# Serper (Recommended - 2,500 free searches)
SERPER_API_KEY=...

# Brave Search
BRAVE_API_KEY=...

# Google Custom Search
GOOGLE_SEARCH_API_KEY=...
GOOGLE_SEARCH_CX=...

# ============================================
# TELEGRAM BOT (Optional)
# ============================================

# Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_CHAT_ID=1222111...

# ============================================
# OPTIONAL CONFIGURATION
# ============================================

# Research settings
MAX_SEARCH_RESULTS=25
MAX_CONCURRENT_REQUESTS=8
OUTPUT_DIR=./outputs
REPORT_FORMAT=markdown,pdf

# Google Docs Integration (Optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
```

### Getting API Keys

#### AI Providers (Choose One)

1. **Gemini (Recommended - Free Tier)**
   - Visit: https://aistudio.google.com/app/apikey
   - Free: 15 requests/minute, 1,500 requests/day

2. **OpenAI (GPT-4)**
   - Visit: https://platform.openai.com/api-keys
   - Paid: ~$0.01 per request

3. **Anthropic (Claude)**
   - Visit: https://console.anthropic.com/
   - Paid: ~$0.015 per request

#### Search APIs (Choose One)

1. **Serper (Recommended)**
   - Visit: https://serper.dev/
   - Free: 2,500 searches/month

2. **Brave Search**
   - Visit: https://brave.com/search/api/
   - Free tier available

3. **Google Custom Search**
   - Visit: https://developers.google.com/custom-search
   - Free: 100 searches/day

#### Telegram Bot (Optional)

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow instructions
3. Copy the bot token to `TELEGRAM_BOT_TOKEN`

## 🚀 Usage

### Command Line Interface

The CLI provides a direct interface to the ADK-TS multi-agent research system.

#### How ADK-TS Powers the CLI

The command-line interface is built entirely around ADK-TS agents:

**1. Agent Pipeline**
```typescript
// When you run the CLI, this workflow executes:
const agent = new AutoResearchAgent();

// Step 1: QueryGeneratorAgent (ADK-TS)
const queries = await queryAgent.generateQueries(topic);
// Uses LlmAgent with temperature 0.7 for creative query generation

// Step 2: SearchService (custom)
const searchResults = await searchService.search(queries);
// Parallel searches across multiple APIs

// Step 3: ContentAnalyzerAgent (ADK-TS)
const analysis = await analyzerAgent.analyze(content);
// Uses LlmAgent with temperature 0.5 for focused analysis

// Step 4: ReportGeneratorAgent (ADK-TS)
const report = await reportAgent.generateReport(analysis);
// Uses LlmAgent with temperature 0.6 for professional writing
```

**2. Agent Builder Pattern**
```typescript
// Each agent is instantiated using ADK-TS AgentBuilder
const { runner } = await AgentBuilder
  .create('queryGenerator')
  .withAgent(queryAgent)
  .build();

// Agents communicate through prompts and JSON responses
const response = await runner.ask(prompt);
```

**3. Multi-Provider Support**
```typescript
// ADK-TS allows flexible model selection
function selectModel(): string {
  if (config.geminiApiKey) return 'gemini-1.5-flash';
  if (config.openaiApiKey) return 'gpt-4o';
  if (config.anthropicApiKey) return 'claude-3-5-sonnet-20241022';
}
```

#### Interactive Mode

```bash
npm run dev
```

The agent will prompt you for:
- Research topic
- Research depth (basic/intermediate/comprehensive)
- Maximum sources
- Include visualizations (yes/no)

**Behind the scenes**: Each input is processed by ADK-TS agents with appropriate temperature settings for the task.

#### Direct Topic Mode

```bash
npm run dev -- "Artificial Intelligence in Healthcare"
```

**What happens**:
1. Input goes directly to the multi-agent pipeline
2. QueryGeneratorAgent creates 5-7 search queries
3. ContentAnalyzerAgent synthesizes findings from all sources
4. ReportGeneratorAgent creates a comprehensive academic report
5. PDF and Markdown files are generated

#### Examples

```bash
# Quick research (basic depth - 3 sources)
npm run dev -- "Climate Change Impact"

# Standard research (intermediate depth - 5 sources)
npm run dev -- "Quantum Computing Basics"

# Run built version
npm start "Renewable Energy Technologies"
```

#### CLI Output

The CLI shows progress as each ADK-TS agent completes:
```
🧠 AutoResearch Agent - Interactive Mode

Step 1/6: Generating intelligent search queries with AI...
✅ Step 1/6: Generated 5 search queries

Step 2/6: Searching 5 queries across multiple sources...
✅ Step 2/6: Found 15 relevant sources

Step 3/6: Extracting content from 15 sources...
✅ Step 3/6: Extracted content from 12 sources

Step 4/6: Analyzing content with AI (this may take a moment)...
✅ Step 4/6: Content analysis complete

Step 5/6: Generating comprehensive research report...
✅ Step 5/6: Report generated successfully

Step 6/6: Creating PDF and Markdown files...
✅ Complete! Generated 2 report files
```

### Telegram Bot

#### Try the Live Bot! 🤖

**Bot Link**: https://t.me/autosearchagentbot

> Just open Telegram, click the link above, and start chatting with the AutoResearch Agent!

#### How the Telegram Bot Works

The Telegram bot provides a conversational interface to the AutoResearch Agent with full ADK-TS integration:

**1. Natural Language Understanding**
- When you send a message, the bot uses a specialized **TopicExtractorAgent** (built with ADK-TS)
- This agent intelligently parses your message to extract the research topic
- Example: "I want to learn about AI in healthcare" → "Artificial Intelligence in Healthcare"

**2. Multi-Agent Research Pipeline**
- Uses the **same ADK-TS agents** as the CLI version:
  - `QueryGeneratorAgent` → Creates search queries
  - `ContentAnalyzerAgent` → Synthesizes findings
  - `ReportGeneratorAgent` → Creates structured report
  
**3. Real-Time Progress Updates**
- The bot sends live updates as each agent completes its work
- You can see the research progress in real-time
- Updates include: Query generation, searching, analysis, and report creation

**4. File Delivery**
- Once research is complete, the bot sends both PDF and Markdown files directly to your chat
- Files are generated using the report generation service and delivered via Telegram's file API

#### Why We Built a Custom Bot

**Initial Attempt**: I tried using **ADK-TS MCP Telegram integration** for the hackathon, which provided excellent interactive messaging capabilities and conversational flow.

**The Challenge**: While MCP Telegram was great for sending messages and creating interactive conversations, I discovered it **could not send files** (PDFs and Markdown reports) - only text messages.

**Our Solution**: I built a custom Telegram bot using Telegraf that:
- ✅ Integrates the **same ADK-TS agents** from the CLI version
- ✅ Adds **file delivery capabilities** for PDF and Markdown reports
- ✅ Maintains the **multi-agent workflow** and intelligence
- ✅ Includes **interactive menus** with inline keyboards
- ✅ Provides **conversational AI** with natural language understanding

This hybrid approach leverages ADK-TS for the core AI logic while adding custom code for features the MCP integration doesn't support.

#### Starting the Bot (For Developers)

**Local Development (Polling Mode):**
```bash
# Development mode (with hot reload)
npm run telegram-bot

# Production mode
npm run bot:prod
```

**Production Deployment (Webhook Mode):**

For deploying to cloud platforms like Render, Heroku, or Railway:

```bash
# Development with webhook (requires ngrok)
npm run bot:webhook

# Production mode
npm run start:webhook
```

**📘 Deployment Guide**: See [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for detailed instructions on deploying to Render.

**Quick Deploy to Render:**
1. Run `./deploy-render.sh` to prepare your project
2. Push to GitHub
3. Connect to Render
4. Set environment variables (see deployment guide)
5. Your bot will be live with webhook support!

#### Using the Bot

1. **Start**: Open https://t.me/autosearchagentbot or send `/start`
2. **Research**: Send any research topic naturally (e.g., "research AI in healthcare")
3. **Choose Depth**: Select Quick (3 sources), Standard (5 sources), or Deep (10+ sources)
4. **Watch Progress**: See real-time updates as the agents work
5. **Receive Files**: Get PDF and Markdown reports delivered directly to your chat

#### Bot Commands

- `/start` - Welcome message and instructions
- `/help` - Detailed help and examples
- `/history` - View your research history (last 10 topics)
- `/settings` - Adjust default research depth preferences
- `/cancel` - Cancel ongoing research

#### Bot Features

- 🎯 **Smart Topic Extraction**: ADK-TS agent understands natural language requests
- 💬 **Conversational AI**: Responds to greetings, questions, and casual chat
- 📊 **Progress Updates**: Real-time updates as each ADK-TS agent completes its work
- 📁 **Direct File Delivery**: Sends PDF and Markdown directly to chat (not available in MCP)
- 🔄 **Research History**: Tracks your previous research topics
- ⚙️ **Customizable**: Set default research depth preferences
- 🎨 **Interactive Menus**: Inline keyboard buttons for easy selection
- 🤖 **Multi-Agent Pipeline**: Same ADK-TS agents as CLI for consistency

### Output

#### Generated Files

Research reports are saved to `./outputs/` (configurable):

```
outputs/
├── research_<topic>_<timestamp>.pdf      # Professional PDF report
└── research_<topic>_<timestamp>.md       # Markdown version
```

#### Report Structure

All reports include:

1. **Title** - Clear, descriptive title
2. **Abstract** - 150-250 word summary
3. **Introduction** - Background and objectives
4. **Literature Review** - Synthesis of existing research
5. **Methodology** - Research approach
6. **Findings** - Key discoveries with evidence
7. **Discussion** - Analysis and implications
8. **Conclusion** - Summary and significance
9. **Recommendations** - Actionable suggestions
10. **References** - Full citations for all sources

## 📁 Project Structure

```
autoresearch-agent/
├── src/
│   ├── agents/                      # ADK-TS Agents
│   │   ├── AutoResearchAgent.ts    # Main orchestrator
│   │   ├── specialized/            # Specialized agents
│   │   │   ├── QueryGeneratorAgent.ts
│   │   │   ├── ContentAnalyzerAgent.ts
│   │   │   ├── ReportGeneratorAgent.ts
│   │   │   └── TopicExtractorAgent.ts
│   │   └── telegram-agent/         # Telegram conversation agent
│   ├── bot/
│   │   └── telegramBot.ts         # Full Telegram bot implementation
│   ├── services/
│   │   ├── searchService.ts       # Multi-API search
│   │   ├── contentExtractionService.ts  # Web scraping
│   │   ├── reportGenerationService.ts   # PDF/Markdown generation
│   │   ├── aiService.ts           # LLM service wrapper
│   │   └── progressTracker.ts     # Real-time progress updates
│   ├── tools/                     # Custom ADK-TS tools
│   │   └── researchTool.ts        # Research workflow tool
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── config/
│   │   └── index.ts              # Configuration management
│   ├── utils/
│   │   └── index.ts              # Helper functions
│   ├── index.ts                  # CLI entry point
│   └── telegram-bot.ts           # Telegram bot entry point
├── outputs/                       # Generated reports
├── .env.example                   # Environment template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── README.md                      # This file
└── LICENSE                        # MIT License
```

## 🛠️ Technologies Used

### Core Framework

- **[ADK-TS](https://www.npmjs.com/package/@iqai/adk)** (0.5.0) - AI Development Kit for TypeScript
  - Agent orchestration
  - LLM integration
  - Multi-agent workflows

### AI/LLM Integration

- **[@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)** - Gemini API
- OpenAI API (via ADK-TS) - GPT-4
- Anthropic API (via ADK-TS) - Claude

### Search & Data

- **[axios](https://www.npmjs.com/package/axios)** - HTTP client for API calls
- **[cheerio](https://www.npmjs.com/package/cheerio)** - HTML parsing and web scraping
- Serper API - Web search
- Brave Search API - Alternative search
- Google Custom Search API - Google search integration

### Report Generation

- **[pdfkit](https://www.npmjs.com/package/pdfkit)** - PDF generation
- **[marked](https://www.npmjs.com/package/marked)** - Markdown parsing

### Bot Framework

- **[telegraf](https://www.npmjs.com/package/telegraf)** - Telegram Bot API framework
- **[dotenv](https://www.npmjs.com/package/dotenv)** - Environment configuration

### Development

- **[TypeScript](https://www.typescriptlang.org/)** (5.3.0) - Type-safe development
- **[tsx](https://www.npmjs.com/package/tsx)** - TypeScript execution
- **[zod](https://www.npmjs.com/package/zod)** - Schema validation
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting

## 🎯 Use Cases

### Academic Research

- Literature reviews
- Background research for papers
- Topic exploration
- Citation gathering

### Professional Work

- Market research
- Competitive analysis
- Industry trend reports
- Due diligence research

### Personal Learning

- Learning new topics
- Exploring interests
- Understanding complex subjects
- Quick reference guides

## 🔒 Privacy & Security

- **API Keys**: Stored locally in `.env` (never committed)
- **Data**: All research data stored locally
- **No Cloud Storage**: Files not uploaded to external services
- **Telegram**: Bot communicates directly, no data persistence

## 🐛 Troubleshooting

### Common Issues

#### "No AI provider configured"

**Solution**: Add at least one API key to `.env`:
```bash
GEMINI_API_KEY=your_key_here
# OR
OPENAI_API_KEY=your_key_here
# OR
ANTHROPIC_API_KEY=your_key_here
```

#### "No search API configured"

**Solution**: Add at least one search API key:
```bash
SERPER_API_KEY=your_key_here
# OR
BRAVE_API_KEY=your_key_here
```

#### "Telegram bot not responding"

**Solution**:
1. Check `TELEGRAM_BOT_TOKEN` in `.env`
2. Verify bot token with @BotFather
3. Ensure bot is running: `npm run bot`

#### "Build failed"

**Solution**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### "PDF generation failed"

**Solution**: Ensure write permissions for `./outputs/` directory:
```bash
mkdir -p outputs
chmod 755 outputs
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ADK-TS Team** - For the excellent AI agent framework
- **OpenAI, Anthropic, Google** - For LLM APIs
- **Serper, Brave** - For search APIs
- **Telegraf** - For Telegram bot framework

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/Olusegun-Light/Auto-Research-Agent/issues)
- **Documentation**: See documentation in source files for detailed implementation guides

## 🚀 Future Enhancements

- [ ] Multi-language support
- [ ] Voice input via Telegram
- [ ] Google Docs integration
- [ ] Research templates
- [ ] Citation format options (APA, MLA, Chicago)
- [ ] Image and chart generation
- [ ] Research collaboration features
- [ ] Export to more formats (DOCX, LaTeX)

---

**Built with ❤️ using ADK-TS for the ADK-TS Hackathon 2025**

⭐ Star this repo if you find it useful!
