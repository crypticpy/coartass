# ============================================================================
# Austin RTASS - Makefile
# ============================================================================
# Common commands for development, testing, and deployment
# Usage: make [target]
# ============================================================================

.PHONY: help install dev build test lint format clean docker-build docker-run docker-push deploy

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Variables
IMAGE_NAME ?= austin-rtass
IMAGE_TAG ?= latest
REGISTRY ?= your-registry.azurecr.io
ENVIRONMENT ?= dev

# ============================================================================
# Help
# ============================================================================

help: ## Show this help message
	@echo "$(BLUE)Austin RTASS - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# ============================================================================
# Development
# ============================================================================

install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm ci

dev: ## Start development server
	@echo "$(YELLOW)Starting development server...$(NC)"
	npm run dev

build: ## Build production bundle
	@echo "$(YELLOW)Building production bundle...$(NC)"
	npm run build

start: ## Start production server (requires build first)
	@echo "$(YELLOW)Starting production server...$(NC)"
	npm run start

# ============================================================================
# Testing & Quality
# ============================================================================

test: ## Run all tests
	@echo "$(YELLOW)Running tests...$(NC)"
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage
	npm run test:coverage

lint: ## Run ESLint
	@echo "$(YELLOW)Running linter...$(NC)"
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

type-check: ## Run TypeScript type checking
	@echo "$(YELLOW)Running type check...$(NC)"
	npm run type-check

format: ## Format code with Prettier
	npm run format

check: lint type-check test ## Run all quality checks

# ============================================================================
# Docker
# ============================================================================

docker-build: ## Build Docker image for local architecture
	@echo "$(YELLOW)Building Docker image...$(NC)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

docker-build-amd64: ## Build Docker image for AMD64 (Azure)
	@echo "$(YELLOW)Building Docker image for AMD64...$(NC)"
	docker buildx build --platform linux/amd64 -t $(IMAGE_NAME):$(IMAGE_TAG) .

docker-run: ## Run Docker container locally
	@echo "$(YELLOW)Running Docker container...$(NC)"
	docker run -p 3000:3000 --env-file .env.local $(IMAGE_NAME):$(IMAGE_TAG)

docker-up: ## Start with Docker Compose
	docker compose up

docker-up-d: ## Start with Docker Compose (detached)
	docker compose up -d

docker-down: ## Stop Docker Compose
	docker compose down

docker-logs: ## Show Docker logs
	docker compose logs -f

docker-push: ## Push image to registry
	@echo "$(YELLOW)Pushing image to $(REGISTRY)...$(NC)"
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
	docker push $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# ============================================================================
# Azure Deployment
# ============================================================================

azure-login: ## Login to Azure
	az login

acr-login: ## Login to Azure Container Registry
	az acr login --name $(shell echo $(REGISTRY) | cut -d'.' -f1)

deploy-infra: ## Deploy Azure infrastructure
	@echo "$(YELLOW)Deploying infrastructure...$(NC)"
	cd infrastructure && ./deploy.sh $(ENVIRONMENT)

deploy: docker-build-amd64 docker-push ## Build, push, and deploy to Azure
	@echo "$(YELLOW)Deploying to Azure...$(NC)"
	cd infrastructure && ./deploy.sh $(ENVIRONMENT) --push

# ============================================================================
# Cleanup
# ============================================================================

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf coverage

clean-all: clean ## Clean everything including node_modules
	rm -rf node_modules

docker-clean: ## Clean Docker images and containers
	docker compose down -v --rmi local
	docker image prune -f

# ============================================================================
# Utilities
# ============================================================================

deps-update: ## Update dependencies interactively
	npx npm-check-updates -i

deps-audit: ## Run security audit
	npm audit

env-check: ## Check environment configuration
	@echo "$(YELLOW)Checking environment...$(NC)"
	@test -f .env.local && echo "$(GREEN).env.local exists$(NC)" || echo "$(RED).env.local missing$(NC)"
	@node -v
	@npm -v
