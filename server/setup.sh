#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Setting up DrinksHarbour Backend${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18 or higher.${NC}"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}📝 Copying environment variables...${NC}"
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file from example${NC}"
    echo -e "${YELLOW}⚠️  Please update the .env file with your actual configuration${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists, skipping...${NC}"
fi

echo -e "${YELLOW}🔧 Setting up database...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker not found. Please install Docker to use containerized services.${NC}"
    echo -e "${YELLOW}   You'll need to install MongoDB and Redis manually.${NC}"
else
    echo -e "${GREEN}🐳 Starting Docker services...${NC}"
    docker-compose up -d mongodb redis
    sleep 10 # Wait for services to start
fi

echo -e "${YELLOW}🔍 Running linting...${NC}"
npm run lint

echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

echo -e "${YELLOW}🌱 Seeding database...${NC}"
npm run seed

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${YELLOW}🎯 Next steps:${NC}"
echo -e "1. Update .env file with your configuration"
echo -e "2. Run 'npm run dev' to start development server"
echo -e "3. Visit http://localhost:5000/health to verify"
echo -e "4. Check API documentation at http://localhost:5000/api-docs"