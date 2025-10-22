#!/bin/bash

# Quick Start Script for AutoResearch Agent
# This script helps you get started quickly

set -e

echo "🧠 AutoResearch Agent - Quick Start"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️  Setting up environment..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env and add your API keys:"
    echo "   - At least one AI provider (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
    echo "   - At least one search provider (SERPER_API_KEY, BRAVE_API_KEY, or GOOGLE_SEARCH_API_KEY)"
    echo ""
    echo "   Run this script again after adding your API keys."
    exit 0
fi

# Check if API keys are configured
if ! grep -q "OPENAI_API_KEY=sk-" .env && ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
    echo "❌ No AI provider API key found in .env"
    echo "   Please add either OPENAI_API_KEY or ANTHROPIC_API_KEY"
    exit 1
fi

if ! grep -q "SERPER_API_KEY=." .env && ! grep -q "BRAVE_API_KEY=." .env && ! grep -q "GOOGLE_SEARCH_API_KEY=." .env; then
    echo "❌ No search API key found in .env"
    echo "   Please add either SERPER_API_KEY, BRAVE_API_KEY, or GOOGLE_SEARCH_API_KEY"
    exit 1
fi

echo "✅ Configuration looks good!"
echo ""

# Create outputs directory
mkdir -p outputs

# Display menu
echo "Choose an option:"
echo ""
echo "  1) Interactive Mode - Prompt for research topic"
echo "  2) Quick Test - Run example research"
echo "  3) Custom Topic - Provide topic as argument"
echo "  4) View Examples - See code examples"
echo "  5) Build Project - Compile TypeScript"
echo ""

read -p "Enter your choice (1-5): " choice
echo ""

case $choice in
    1)
        echo "🚀 Starting interactive mode..."
        npm run dev
        ;;
    2)
        echo "🚀 Running quick test on 'Artificial Intelligence'..."
        npm run dev -- "Artificial Intelligence"
        ;;
    3)
        read -p "Enter research topic: " topic
        if [ -z "$topic" ]; then
            echo "❌ Topic cannot be empty"
            exit 1
        fi
        echo "🚀 Starting research on: $topic"
        npm run dev -- "$topic"
        ;;
    4)
        echo "📚 Available examples:"
        echo ""
        echo "  Example 1: Basic Research"
        echo "  Example 2: Comprehensive Research with Visualizations"
        echo "  Example 3: Monitoring Progress"
        echo "  Example 4: Custom Configuration"
        echo ""
        read -p "Run example (1-4 or 'all'): " example
        npm run dev src/examples.ts "$example"
        ;;
    5)
        echo "🔨 Building project..."
        npm run build
        echo "✅ Build complete! Run with: node dist/index.js"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "===================================="
echo "✅ Done! Check the outputs/ directory for generated reports."
echo ""
