#!/usr/bin/env node
/**
 * CLI: Build system prompt from config and print to stdout.
 * Usage: node dist/cli/build-prompt.js [path-to-config.json]
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import type { BusinessConfig } from '../config/types.js';
import { DEFAULT_CONFIG } from '../config/types.js';

const configPath =
  process.argv[2] ?? resolve(process.cwd(), 'config', 'example-business.json');

const raw = readFileSync(configPath, 'utf-8');
const partial = JSON.parse(raw) as Partial<BusinessConfig>;
const config: BusinessConfig = {
  ...DEFAULT_CONFIG,
  BUSINESS_NAME: partial.BUSINESS_NAME ?? 'Business',
  BUSINESS_TYPE: partial.BUSINESS_TYPE ?? 'Business',
  BUSINESS_LANGUAGE_MODE: partial.BUSINESS_LANGUAGE_MODE ?? 'english',
  BUSINESS_HOURS: partial.BUSINESS_HOURS ?? '',
  SERVICES_OR_MENU: partial.SERVICES_OR_MENU ?? '',
  BOOKING_RULES: partial.BOOKING_RULES ?? '',
  LOCATION_AREA: partial.LOCATION_AREA ?? '',
  WHATSAPP_CONFIRMATION_REQUIRED: partial.WHATSAPP_CONFIRMATION_REQUIRED ?? true,
  MAX_BOOKING_DAYS_AHEAD: partial.MAX_BOOKING_DAYS_AHEAD ?? 14,
  menu_items: partial.menu_items,
  ai_enabled: partial.ai_enabled,
} as BusinessConfig;

console.log(buildSystemPrompt(config));
