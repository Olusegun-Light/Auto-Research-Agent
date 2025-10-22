#!/bin/bash

# ============================================
# AutoResearch Agent - Complete Setup Guide
# ============================================

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       🧠 AutoResearch Agent - Complete Setup Guide             ║"
echo "║                                                                 ║"
echo "║  Autonomous AI Research Agent built with ADK-TS Patterns       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Function to print section headers
print_header() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  $1"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Function to print step
print_step() {
    echo "[$1] $2"
}

# Function to print success
print_success() {
    echo "✅ $1"
}

# Function to print error
print_error() {
    echo "❌ $1"
}

# Function to print warning
print_warning() {
    echo "⚠️  $1"
}

# Function to print info
print_info() {
    echo "ℹ️  $1"
}

# ============================================
# Step 1: Check Prerequisites
# ============================================

print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js is installed: $NODE_VERSION"
    
    # Check if version is 18+
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_warning "Node.js 18+ recommended. Current: $NODE_VERSION"
    fi
else
    print_error "Node.js is not installed"
    echo ""
    print_info "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm is installed: v$NPM_VERSION"
else
    print_error "npm is not installed"
    exit 1
fi

# ============================================
# Step 2: Install Dependencies
# ============================================

print_header "Step 2: Installing Dependencies"

if [ -d "node_modules" ]; then
    print_info "Dependencies already installed"
    read -p "Reinstall dependencies? (y/N): " reinstall
    if [[ $reinstall == "y" || $reinstall == "Y" ]]; then
        print_step "2.1" "Removing old dependencies..."
        rm -rf node_modules package-lock.json
        print_step "2.2" "Installing fresh dependencies..."
        npm install
        print_success "Dependencies reinstalled"
    else
        print_success "Using existing dependencies"
    fi
else
    print_step "2.1" "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully"
fi

# ============================================
# Step 3: Build Project
# ============================================

print_header "Step 3: Building TypeScript Project"

print_step "3.1" "Compiling TypeScript..."
if npm run build &> /dev/null; then
    print_success "Build successful"
    
    # Count generated files
    JS_FILES=$(find dist -name "*.js" 2>/dev/null | wc -l)
    print_info "Generated $JS_FILES JavaScript files"
else
    print_error "Build failed"
    echo ""
    print_info "Running build with output..."
    npm run build
    exit 1
fi

# ============================================
# Step 4: Configure Environment
# ============================================

print_header "Step 4: Configuring Environment"

if [ -f ".env" ]; then
    print_success ".env file exists"
    
    # Check for API keys
    HAS_AI_KEY=false
    HAS_SEARCH_KEY=false
    
    if grep -q "OPENAI_API_KEY=sk-" .env || grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        HAS_AI_KEY=true
        print_success "AI provider API key found"
    else
        print_warning "No AI provider API key configured"
    fi
    
    if grep -q "SERPER_API_KEY=." .env && ! grep -q "SERPER_API_KEY=$" .env; then
        HAS_SEARCH_KEY=true
        print_success "Search API key found"
    elif grep -q "BRAVE_API_KEY=." .env && ! grep -q "BRAVE_API_KEY=$" .env; then
        HAS_SEARCH_KEY=true
        print_success "Search API key found"
    elif grep -q "GOOGLE_SEARCH_API_KEY=." .env && ! grep -q "GOOGLE_SEARCH_API_KEY=$" .env; then
        HAS_SEARCH_KEY=true
        print_success "Search API key found"
    else
        print_warning "No search API key configured"
    fi
    
    if [ "$HAS_AI_KEY" = false ] || [ "$HAS_SEARCH_KEY" = false ]; then
        echo ""
        print_warning "Configuration incomplete. You need:"
        if [ "$HAS_AI_KEY" = false ]; then
            echo "  • AI Provider: OPENAI_API_KEY or ANTHROPIC_API_KEY"
        fi
        if [ "$HAS_SEARCH_KEY" = false ]; then
            echo "  • Search Provider: SERPER_API_KEY, BRAVE_API_KEY, or GOOGLE_SEARCH_API_KEY"
        fi
        echo ""
        read -p "Open .env file to configure? (y/N): " open_env
        if [[ $open_env == "y" || $open_env == "Y" ]]; then
            ${EDITOR:-nano} .env
        fi
    fi
else
    print_warning ".env file not found"
    print_step "4.1" "Creating .env from template..."
    cp .env.example .env
    print_success ".env file created"
    echo ""
    print_info "Please edit .env and add your API keys"
    echo ""
    read -p "Open .env file now? (y/N): " open_env
    if [[ $open_env == "y" || $open_env == "Y" ]]; then
        ${EDITOR:-nano} .env
    fi
fi

# ============================================
# Step 5: Create Output Directory
# ============================================

print_header "Step 5: Preparing Output Directory"

mkdir -p outputs
print_success "Output directory ready: ./outputs/"

# ============================================
# Step 6: Verify Installation
# ============================================

print_header "Step 6: Verifying Installation"

CHECKS_PASSED=true

# Check dist directory
if [ -d "dist" ]; then
    print_success "Compiled files present"
else
    print_error "Compiled files missing"
    CHECKS_PASSED=false
fi

# Check source files
SOURCE_FILES=$(find src -name "*.ts" 2>/dev/null | wc -l)
if [ "$SOURCE_FILES" -gt 0 ]; then
    print_success "Source files present ($SOURCE_FILES files)"
else
    print_error "Source files missing"
    CHECKS_PASSED=false
fi

# Check documentation
DOC_FILES=$(find docs -name "*.md" 2>/dev/null | wc -l)
if [ "$DOC_FILES" -gt 0 ]; then
    print_success "Documentation present ($DOC_FILES files)"
else
    print_warning "Documentation incomplete"
fi

# Check configuration
if [ -f "tsconfig.json" ] && [ -f "package.json" ]; then
    print_success "Configuration files present"
else
    print_error "Configuration files missing"
    CHECKS_PASSED=false
fi

if [ "$CHECKS_PASSED" = false ]; then
    echo ""
    print_error "Installation verification failed"
    exit 1
fi

# ============================================
# Step 7: Display Next Steps
# ============================================

print_header "🎉 Setup Complete!"

echo "Your AutoResearch Agent is ready to use!"
echo ""
echo "Quick Start Options:"
echo ""
echo "  1️⃣  Interactive Mode:"
echo "     npm run dev"
echo ""
echo "  2️⃣  Direct Research:"
echo "     npm run dev -- \"Your Research Topic\""
echo ""
echo "  3️⃣  Production Mode:"
echo "     node dist/index.js \"Your Research Topic\""
echo ""
echo "  4️⃣  Quick Start Script:"
echo "     ./quickstart.sh"
echo ""

print_header "📚 Documentation"

echo "Available guides in the docs/ directory:"
echo ""
echo "  • GETTING_STARTED.md      - Detailed setup and usage"
echo "  • SYSTEM_DESIGN.md        - Architecture and design"
echo "  • HACKATHON_SUBMISSION.md - Hackathon information"
echo "  • ADK_TS_INTEGRATION.md   - ADK-TS integration details"
echo "  • PROJECT_STATUS.md       - Current status and checklist"
echo ""

print_header "🔑 Getting API Keys"

echo "Required API Keys:"
echo ""
echo "  AI Provider (choose one):"
echo "    • OpenAI:    https://platform.openai.com/api-keys"
echo "    • Anthropic: https://console.anthropic.com/"
echo ""
echo "  Search Provider (choose one):"
echo "    • Serper:       https://serper.dev/ (Recommended - Free tier)"
echo "    • Brave Search: https://brave.com/search/api/"
echo "    • Google CSE:   https://developers.google.com/custom-search"
echo ""

print_header "💡 Example Commands"

echo "Try these example research topics:"
echo ""
echo "  npm run dev -- \"Artificial Intelligence in Healthcare\""
echo "  npm run dev -- \"Climate Change Impact on Agriculture\""
echo "  npm run dev -- \"Quantum Computing Applications\""
echo "  npm run dev -- \"Renewable Energy Technologies\""
echo ""

print_header "📊 Project Structure"

echo "autoresearch-agent/"
echo "├── src/              - TypeScript source code"
echo "│   ├── agents/       - Main agent implementation"
echo "│   ├── services/     - Core services (search, extraction, AI)"
echo "│   ├── types/        - TypeScript type definitions"
echo "│   ├── utils/        - Utility functions"
echo "│   └── config/       - Configuration management"
echo "├── dist/             - Compiled JavaScript"
echo "├── outputs/          - Generated research reports"
echo "├── docs/             - Comprehensive documentation"
echo "└── .env              - Environment configuration"
echo ""

print_header "🚀 Ready to Start!"

echo "Run your first research with:"
echo ""
echo "  npm run dev"
echo ""
echo "or"
echo ""
echo "  npm run dev -- \"Your Topic Here\""
echo ""
echo "Reports will be saved to: ./outputs/"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
print_success "Setup completed successfully! Happy researching! 🎉"
echo ""
