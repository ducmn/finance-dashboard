#!/bin/bash
# Finance Dashboard - Local Development Setup (React + FastAPI)

set -e

echo "🔧 Setting up Finance Dashboard for local development..."

# Setup Python backend
echo ""
echo "📦 Setting up Python backend..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "   Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "   Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "   Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Setup React frontend
echo ""
echo "📦 Setting up React frontend..."
cd frontend

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install frontend dependencies
echo "   Installing Node dependencies..."
npm install

cd ..

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 To start developing:"
echo ""
echo "   Backend:"
echo "     1. source venv/bin/activate"
echo "     2. python main.py"
echo "     3. Open http://localhost:8000 for API docs"
echo ""
echo "   Frontend (in a new terminal):"
echo "     1. cd frontend"
echo "     2. npm run dev"
echo "     3. Open http://localhost:3000 in your browser"
echo ""
echo "💡 Or use Docker:"
echo "     docker-compose up --build"
echo ""
