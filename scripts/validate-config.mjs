#!/usr/bin/env node

/**
 * Configuration Validation Script
 *
 * This script validates your OpenAI configuration without starting the full server.
 * Run this to quickly check if your .env.local file is set up correctly.
 *
 * Usage:
 *   node scripts/validate-config.mjs
 *   npm run validate-config  (if you add it to package.json scripts)
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function header(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`  ${message}`, 'bold');
  log(`${'='.repeat(60)}`, 'blue');
}

// Load .env.local file
function loadEnvFile() {
  const envPath = join(projectRoot, '.env.local');

  if (!existsSync(envPath)) {
    return null;
  }

  const content = readFileSync(envPath, 'utf-8');
  const env = {};

  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });

  return env;
}

// Validation checks
function checkFileExists() {
  const envPath = join(projectRoot, '.env.local');
  const exists = existsSync(envPath);

  if (exists) {
    success('.env.local file exists');
    return true;
  } else {
    error('.env.local file not found');
    info('Create it by running: cp .env.local.example .env.local');
    return false;
  }
}

function validateAzureConfig(env) {
  header('Azure OpenAI Configuration');

  const hasApiKey = !!env.AZURE_OPENAI_API_KEY;
  const hasEndpoint = !!env.AZURE_OPENAI_ENDPOINT;

  if (!hasApiKey && !hasEndpoint) {
    info('Azure OpenAI not configured (this is OK if using standard OpenAI)');
    return false;
  }

  // Check API Key
  if (hasApiKey) {
    const apiKey = env.AZURE_OPENAI_API_KEY;
    if (apiKey.includes('your-') || apiKey.includes('example') || apiKey.length < 10) {
      error('AZURE_OPENAI_API_KEY appears to be a placeholder');
      info('Replace it with your actual API key from Azure Portal');
    } else {
      success('AZURE_OPENAI_API_KEY is set');
    }
  } else {
    error('AZURE_OPENAI_API_KEY is missing');
  }

  // Check Endpoint
  if (hasEndpoint) {
    const endpoint = env.AZURE_OPENAI_ENDPOINT;

    if (endpoint.includes('your-') || endpoint.includes('example')) {
      error('AZURE_OPENAI_ENDPOINT appears to be a placeholder');
      info('Replace it with your actual endpoint from Azure Portal');
    } else if (!endpoint.startsWith('https://')) {
      error('AZURE_OPENAI_ENDPOINT must start with https://');
      info(`Current value: ${endpoint}`);
    } else if (endpoint.endsWith('/')) {
      warning('AZURE_OPENAI_ENDPOINT should not end with a slash');
      info(`Current: ${endpoint}`);
      info(`Should be: ${endpoint.slice(0, -1)}`);
    } else {
      success('AZURE_OPENAI_ENDPOINT is properly formatted');
      info(`Endpoint: ${endpoint}`);
    }
  } else {
    error('AZURE_OPENAI_ENDPOINT is missing');
  }

  // Check API Version
  const apiVersion = env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
  success(`AZURE_OPENAI_API_VERSION: ${apiVersion}`);

  // Check Deployments
  const whisperDeployment = env.AZURE_OPENAI_WHISPER_DEPLOYMENT;
  const gpt5Deployment = env.AZURE_OPENAI_GPT5_DEPLOYMENT;
  const gpt4Deployment = env.AZURE_OPENAI_GPT4_DEPLOYMENT;

  if (whisperDeployment) {
    success(`AZURE_OPENAI_WHISPER_DEPLOYMENT: ${whisperDeployment}`);
  } else {
    warning('AZURE_OPENAI_WHISPER_DEPLOYMENT not set (will use default: whisper-1)');
  }

  if (gpt5Deployment) {
    success(`AZURE_OPENAI_GPT5_DEPLOYMENT: ${gpt5Deployment}`);
  } else if (gpt4Deployment) {
    warning(
      'AZURE_OPENAI_GPT5_DEPLOYMENT not set, using legacy AZURE_OPENAI_GPT4_DEPLOYMENT value.'
    );
    success(`AZURE_OPENAI_GPT4_DEPLOYMENT: ${gpt4Deployment}`);
  } else {
    warning('AZURE_OPENAI_GPT5_DEPLOYMENT not set (will use default: gpt-5)');
  }

  return hasApiKey && hasEndpoint;
}

function validateOpenAIConfig(env) {
  header('Standard OpenAI Configuration');

  const hasApiKey = !!env.OPENAI_API_KEY;

  if (!hasApiKey) {
    info('Standard OpenAI not configured (this is OK if using Azure)');
    return false;
  }

  const apiKey = env.OPENAI_API_KEY;

  if (apiKey.includes('your-') || apiKey.includes('example') || apiKey.length < 20) {
    error('OPENAI_API_KEY appears to be a placeholder');
    info('Replace it with your actual API key from OpenAI Platform');
  } else if (!apiKey.startsWith('sk-')) {
    warning('OPENAI_API_KEY should start with "sk-" or "sk-proj-"');
  } else {
    success('OPENAI_API_KEY is set and formatted correctly');
  }

  const orgId = env.OPENAI_ORGANIZATION_ID;
  if (orgId) {
    success(`OPENAI_ORGANIZATION_ID: ${orgId}`);
  } else {
    info('OPENAI_ORGANIZATION_ID not set (optional, only needed for multi-org accounts)');
  }

  return hasApiKey;
}

function checkForOldLocalStorageKeys() {
  header('Legacy Storage Check');

   
  const _oldKeys = [
    'azure_openai_api_key',
    'whisper_deployment_name',
    'gpt4_deployment_name',
    'azure_openai_endpoint',
  ];

  warning('Note: API keys are no longer stored in browser localStorage');
  info('All credentials must be in .env.local file');
  info('If you have old data in localStorage, clear it via Settings > Clear All Local Data');
}

function generateSummary(azureConfigured, openaiConfigured) {
  header('Configuration Summary');

  if (azureConfigured) {
    success('Azure OpenAI is configured and ready to use');
    info('The application will use Azure OpenAI Service');
  } else if (openaiConfigured) {
    success('Standard OpenAI is configured and ready to use');
    info('The application will use OpenAI Platform API');
  } else {
    error('No valid configuration found');
    log('\nPlease configure one of the following:', 'yellow');
    log('\nOption 1: Azure OpenAI (Recommended)', 'cyan');
    log('  AZURE_OPENAI_API_KEY=your-key');
    log('  AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com');
    log('\nOption 2: Standard OpenAI', 'cyan');
    log('  OPENAI_API_KEY=sk-your-key');
    log('\nSee .env.local.example for detailed instructions');
  }
}

function printNextSteps(configured) {
  header('Next Steps');

  if (configured) {
    success('Configuration looks good!');
    log('\n1. Start the development server:', 'cyan');
    log('   npm run dev\n');
    log('2. Open the application in your browser:', 'cyan');
    log('   http://localhost:3000\n');
    log('3. Verify configuration in Settings dialog:', 'cyan');
    log('   - Click the Settings icon in the header');
    log('   - Check for green checkmark (✅) under API Configuration\n');
    log('4. Test functionality:', 'cyan');
    log('   - Upload a test audio file');
    log('   - Verify transcription works\n');
  } else {
    error('Configuration incomplete');
    log('\n1. Edit .env.local and add your API credentials', 'cyan');
    log('2. Run this script again to validate: node scripts/validate-config.mjs', 'cyan');
    log('3. See lib/docs/ENV_SETUP.md for detailed setup instructions\n', 'cyan');
  }
}

// Main execution
function main() {
  log('\n');
  header('OpenAI Configuration Validator');
  log('\nThis script checks if your .env.local file is configured correctly.\n');

  // Check if .env.local exists
  if (!checkFileExists()) {
    printNextSteps(false);
    process.exit(1);
  }

  // Load environment variables
  const env = loadEnvFile();

  if (!env) {
    error('Failed to load .env.local');
    process.exit(1);
  }

  // Validate configurations
  const azureConfigured = validateAzureConfig(env);
  const openaiConfigured = validateOpenAIConfig(env);

  // Check for legacy storage
  checkForOldLocalStorageKeys();

  // Generate summary
  generateSummary(azureConfigured, openaiConfigured);

  // Print next steps
  const isConfigured = azureConfigured || openaiConfigured;
  printNextSteps(isConfigured);

  log('\n');
  process.exit(isConfigured ? 0 : 1);
}

main();
