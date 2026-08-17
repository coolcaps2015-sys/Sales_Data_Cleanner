#!/bin/bash
# quick-start.sh
# Quick start script for development and deployment

echo "🚀 Sales Data App - Quick Start"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "📥 Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found!"
    echo "📂 Please run this script from the project root directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "Choose an option:"
echo "1️⃣  Start local development server"
echo "2️⃣  Deploy to Vercel"
echo "3️⃣  View documentation"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔥 Starting development server..."
        echo "📍 Open: http://localhost:3000"
        npm run dev
        ;;
    2)
        echo ""
        echo "☁️  Deploying to Vercel..."
        echo "🔗 Install Vercel CLI: npm install -g vercel"
        echo "📝 Then run: vercel --prod"
        echo ""
        npx vercel --prod
        ;;
    3)
        echo ""
        echo "📖 Opening documentation..."
        if command -v open &> /dev/null; then
            open README.md
        elif command -v xdg-open &> /dev/null; then
            xdg-open README.md
        else
            echo "📄 See: README.md and DEPLOYMENT_GUIDE.md"
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
