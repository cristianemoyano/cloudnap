#!/bin/bash

# CloudNap Docker Build and Push Script
# This script builds the Docker image and pushes it to DockerHub

set -e  # Exit on any error

# Configuration
IMAGE_NAME="cloudnap"
DOCKERHUB_USERNAME="clifford666"
DOCKERHUB_REPOSITORY=""
TAG="latest"
VERSION=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --username USERNAME    DockerHub username (required)"
    echo "  -r, --repository REPO      DockerHub repository name (default: cloudnap)"
    echo "  -t, --tag TAG              Image tag (default: latest)"
    echo "  -v, --version VERSION      Version tag (optional)"
    echo "  --no-cache                 Build without cache"
    echo "  --push-only                Only push, don't build"
    echo "  --build-only               Only build, don't push"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -u myusername"
    echo "  $0 -u myusername -r my-cloudnap -t v1.0.0"
    echo "  $0 -u myusername --no-cache"
}

# Parse command line arguments
BUILD_ONLY=false
PUSH_ONLY=false
NO_CACHE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--username)
            DOCKERHUB_USERNAME="$2"
            shift 2
            ;;
        -r|--repository)
            DOCKERHUB_REPOSITORY="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --push-only)
            PUSH_ONLY=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$DOCKERHUB_USERNAME" ]]; then
    print_error "DockerHub username is required. Use -u or --username option."
    show_usage
    exit 1
fi

# Set default repository name if not provided
if [[ -z "$DOCKERHUB_REPOSITORY" ]]; then
    DOCKERHUB_REPOSITORY="$IMAGE_NAME"
fi

# Construct full image name
FULL_IMAGE_NAME="$DOCKERHUB_USERNAME/$DOCKERHUB_REPOSITORY:$TAG"

# Add version tag if provided
if [[ -n "$VERSION" ]]; then
    VERSION_IMAGE_NAME="$DOCKERHUB_USERNAME/$DOCKERHUB_REPOSITORY:$VERSION"
fi

print_status "Starting Docker build and push process..."
print_status "DockerHub Username: $DOCKERHUB_USERNAME"
print_status "Repository: $DOCKERHUB_REPOSITORY"
print_status "Tag: $TAG"
if [[ -n "$VERSION" ]]; then
    print_status "Version: $VERSION"
fi
print_status "Full Image Name: $FULL_IMAGE_NAME"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if user is logged in to DockerHub
if ! docker info | grep -q "Username:"; then
    print_warning "You are not logged in to DockerHub."
    print_status "Please run: docker login"
    read -p "Do you want to login now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker login
    else
        print_error "Login required to push images."
        exit 1
    fi
fi

# Build the image
if [[ "$PUSH_ONLY" != true ]]; then
    print_status "Building Docker image..."
    
    # Check if Dockerfile exists
    if [[ ! -f "Dockerfile" ]]; then
        print_error "Dockerfile not found in current directory."
        exit 1
    fi
    
    # Build command
    BUILD_CMD="docker build $NO_CACHE -t $FULL_IMAGE_NAME ."
    
    if [[ -n "$VERSION" ]]; then
        BUILD_CMD="$BUILD_CMD -t $VERSION_IMAGE_NAME"
    fi
    
    print_status "Running: $BUILD_CMD"
    
    if eval $BUILD_CMD; then
        print_success "Docker image built successfully!"
        
        # Show image details
        print_status "Built images:"
        docker images | grep "$DOCKERHUB_USERNAME/$DOCKERHUB_REPOSITORY" | head -5
    else
        print_error "Failed to build Docker image."
        exit 1
    fi
fi

# Push the image
if [[ "$BUILD_ONLY" != true ]]; then
    print_status "Pushing Docker image to DockerHub..."
    
    # Push main tag
    if docker push "$FULL_IMAGE_NAME"; then
        print_success "Successfully pushed $FULL_IMAGE_NAME"
    else
        print_error "Failed to push $FULL_IMAGE_NAME"
        exit 1
    fi
    
    # Push version tag if provided
    if [[ -n "$VERSION" ]]; then
        if docker push "$VERSION_IMAGE_NAME"; then
            print_success "Successfully pushed $VERSION_IMAGE_NAME"
        else
            print_error "Failed to push $VERSION_IMAGE_NAME"
            exit 1
        fi
    fi
    
    print_success "All images pushed successfully to DockerHub!"
    print_status "You can now pull the image with:"
    print_status "  docker pull $FULL_IMAGE_NAME"
    if [[ -n "$VERSION" ]]; then
        print_status "  docker pull $VERSION_IMAGE_NAME"
    fi
fi

print_success "Build and push process completed successfully!"
