#!/bin/bash
# Finance Dashboard - Quick Start Script with React Frontend

set -e

echo "🚀 Starting Finance Dashboard (React + FastAPI)..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Build and start the application
echo "📦 Building and starting containers..."
docker-compose up --build -d

# Wait for the service to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "finance-dashboard-backend" && docker-compose ps | grep -q "finance-dashboard-frontend"; then
    echo "✅ Finance Dashboard is running!"
    echo ""
    echo "📊 Dashboard URLs:"
    echo "   - Frontend:   http://localhost:3000"
    echo "   - Backend:    http://localhost:8000"
    echo "   - API Docs:   http://localhost:8000/docs"
    echo ""
    echo "📝 Useful commands:"
    echo "   - View logs:          docker-compose logs -f"
    echo "   - Stop containers:    docker-compose down"
    echo "   - Restart:            docker-compose restart"
else
    echo "❌ Failed to start Finance Dashboard"
    echo "Run 'docker-compose logs' for more details"
    exit 1
fi
