# AutoResearch Agent

> 🏆 **ADK-TS Hackathon 2025 Submission**

An intelligent, autonomous research agent powered by **ADK-TS** (AI Development Kit for TypeScript) that conducts comprehensive academic research on any topic. The agent searches multiple sources, extracts content, synthesizes findings using AI, and generates professional research reports in PDF and Markdown formats.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.3.0-blue.svg)
![ADK-TS](https://img.shields.io/badge/ADK--TS-0.5.0-orange.svg)

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

### Core Concepts

This project demonstrates proper ADK-TS patterns and best practices:

#### 1. Agent Creation with `LlmAgent`

```typescript
import { LlmAgent } from '@iqai/adk';

export function createQueryGeneratorAgent(model: string): LlmAgent {
  return new LlmAgent({
    name: 'query_generator',
    model: 'gemini-1.5-flash',  // or 'gpt-4o', 'claude-3-5-sonnet'
    description: 'Generates diverse search queries for research',
    instruction: `You are an expert research librarian...`,
    outputKey: 'search_queries',
    generateContentConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });
}
```

#### 2. Agent Orchestration with `AgentBuilder`

```typescript
import { AgentBuilder } from '@iqai/adk';

const queryAgent = createQueryGeneratorAgent('gemini-1.5-flash');

const { runner } = await AgentBuilder
  .create('queryGenerator')
  .withAgent(queryAgent)
  .build();

const response = await runner.ask(prompt);
```

#### 3. Multi-Agent Workflow

The `AutoResearchAgent` coordinates three specialized agents:

- **QueryGeneratorAgent**: Generates diverse search queries
  - Temperature: 0.7 (balanced creativity)
  - Max tokens: 500
  
- **ContentAnalyzerAgent**: Analyzes and synthesizes content
  - Temperature: 0.5 (focused analysis)
  - Max tokens: 2000
  
- **ReportGeneratorAgent**: Creates structured reports
  - Temperature: 0.6 (professional writing)
  - Max tokens: 4000

### Key ADK-TS Features Used

✅ **LlmAgent**: Specialized agent creation with clear roles  
✅ **AgentBuilder**: Proper agent instantiation and runner creation  
✅ **Model Flexibility**: Support for GPT-4, Claude, and Gemini  
✅ **Prompt Engineering**: Structured prompts for consistent outputs  
✅ **Error Handling**: Graceful fallbacks when agents fail  
✅ **JSON Outputs**: Structured data extraction from LLM responses  

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

#### Interactive Mode

```bash
npm run dev
```

The agent will prompt you for:
- Research topic
- Research depth (basic/intermediate/comprehensive)
- Maximum sources
- Include visualizations (yes/no)

#### Direct Topic Mode

```bash
npm run dev -- "Artificial Intelligence in Healthcare"
```

#### Examples

```bash
# Quick research
npm run dev -- "Climate Change Impact"

# Run built version
npm start "Quantum Computing Basics"
```

### Telegram Bot

#### Starting the Bot

```bash
# Development mode (with hot reload)
npm run telegram-bot

# Production mode
npm run bot:prod
```

#### Using the Bot

1. **Start**: Send `/start` to your bot
2. **Research**: Send any research topic
3. **Choose Depth**: Select Quick/Standard/Deep research
4. **Wait**: Research takes 1-5 minutes depending on depth
5. **Receive**: Bot sends PDF and Markdown files directly

#### Bot Commands

- `/start` - Welcome message and instructions
- `/help` - Detailed help and examples
- `/history` - View your research history
- `/settings` - Adjust default preferences
- `/cancel` - Cancel ongoing research

#### Bot Features

- 🎯 **Smart Topic Extraction**: Understands natural language requests
- 💬 **Conversational**: Responds to greetings and casual chat
- 📊 **Progress Updates**: Real-time updates during research
- 📁 **Direct File Delivery**: Sends PDF and Markdown directly to chat
- 🔄 **Research History**: Tracks your previous research topics
- ⚙️ **Customizable**: Set default research depth preferences
- 🎨 **Interactive Menus**: Inline keyboard buttons for easy selection

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
