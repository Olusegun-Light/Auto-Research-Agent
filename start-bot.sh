#!/bin/bash

# Simple Start Script for Telegram Bot

echo "🤖 Starting AutoResearch Telegram Bot"
echo "======================================"
echo ""

# Check .env
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Create .env with TELEGRAM_BOT_TOKEN"
    exit 1
fi

# Build
echo "📦 Building..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🚀 Starting bot..."
echo ""
echo "Bot works like CLI:"
echo "  • User sends research topic"
echo "  • Bot calls AutoResearchAgent"
echo "  • Files save to outputs/"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start
npm run telegram-bot
