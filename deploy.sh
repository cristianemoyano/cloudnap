#!/bin/bash

# CloudNap Deployment Script for Docker Swarm
# This script helps deploy CloudNap to a Docker Swarm cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="cloudnap"
IMAGE_NAME="cloudnap"
IMAGE_TAG="latest"

echo -e "${BLUE}CloudNap Docker Swarm Deployment Script${NC}"
echo "=============================================="

# Check if Docker Swarm is initialized
if ! docker info | grep -q "Swarm: active"; then
    echo -e "${RED}Error: Docker Swarm is not initialized${NC}"
    echo "Please run: docker swarm init"
    exit 1
fi

# Check if required environment variables are set
required_vars=("HUAWEI_ACCESS_KEY" "HUAWEI_SECRET_KEY" "HUAWEI_PROJECT_ID")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these variables before running the deployment script."
    exit 1
fi

# Build the Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

# Create Docker secrets
echo -e "${YELLOW}Creating Docker secrets...${NC}"
echo "$HUAWEI_ACCESS_KEY" | docker secret create huawei_access_key - 2>/dev/null || echo "Secret huawei_access_key already exists"
echo "$HUAWEI_SECRET_KEY" | docker secret create huawei_secret_key - 2>/dev/null || echo "Secret huawei_secret_key already exists"
echo "$HUAWEI_PROJECT_ID" | docker secret create huawei_project_id - 2>/dev/null || echo "Secret huawei_project_id already exists"

# Deploy the stack
echo -e "${YELLOW}Deploying CloudNap stack...${NC}"
docker stack deploy -c docker-swarm.yaml "$STACK_NAME"

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 10

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
docker service ls --filter "name=${STACK_NAME}"

# Show service logs
echo -e "${YELLOW}Service logs:${NC}"
docker service logs "${STACK_NAME}_cloudnap" --tail 20

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "Services are available at:"
echo "  - Web Interface: http://localhost"
echo "  - API: http://localhost/api"
echo "  - Health Check: http://localhost/api/health"
echo ""
echo "Useful commands:"
echo "  - View services: docker service ls"
echo "  - View logs: docker service logs ${STACK_NAME}_cloudnap"
echo "  - Scale service: docker service scale ${STACK_NAME}_cloudnap=3"
echo "  - Remove stack: docker stack rm $STACK_NAME"
echo ""
echo -e "${BLUE}Happy cloud napping! ☁️😴${NC}"
