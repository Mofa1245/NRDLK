import type { MenuItem } from '../menu/parser.js';

/**
 * Business variables passed into the voice agent (injected into system prompt).
 */
export type BusinessLanguageMode = 'arabic' | 'bilingual' | 'english';

export interface BusinessConfig {
  BUSINESS_NAME: string;
  BUSINESS_TYPE: string;
  BUSINESS_LANGUAGE_MODE: BusinessLanguageMode;
  BUSINESS_HOURS: string;
  SERVICES_OR_MENU: string;
  BOOKING_RULES: string;
  LOCATION_AREA: string;
  WHATSAPP_CONFIRMATION_REQUIRED: boolean;
  MAX_BOOKING_DAYS_AHEAD: number;
  /** Optional structured menu for parser; improves recognition with synonyms */
  menu_items?: MenuItem[];
  /** Optional: AI on/off (dashboard can toggle) */
  ai_enabled?: boolean;
  /** Incremented when business edits hours/menu; attach to each call log to prevent "old menu" disputes */
  config_version?: number;
  /** Production: use locked WhatsApp templates only (BOOKING_TEMPLATE_V1, etc.); do not send free-form */
  useWhatsAppTemplates?: boolean;
}

export const DEFAULT_CONFIG: Partial<BusinessConfig> = {
  WHATSAPP_CONFIRMATION_REQUIRED: true,
  MAX_BOOKING_DAYS_AHEAD: 14,
  ai_enabled: true,
  config_version: 1,
};
