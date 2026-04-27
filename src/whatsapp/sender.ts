import type { ConversationOutput } from '../schemas/conversation-output.js';
import { isLowConfidence, isHumanFallback } from '../schemas/conversation-output.js';
import {
  getTemplateName,
  getTemplateParams,
  getTemplateBodyForLog,
} from './templates.js';

export interface WhatsAppPayload {
  to: string; // phone number
  message: string;
  flagged: boolean;
  high_priority: boolean;
  payload: ConversationOutput;
  /** In production use locked templates only; set by buildWhatsAppMessage(..., { useTemplates: true }) */
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppSender {
  send(payload: WhatsAppPayload): Promise<void>;
}

/**
 * Build the message for WhatsApp. In production use locked templates only (useTemplates: true).
 * When useTemplates is true: message is template body for log/queue; templateName + templateParams
 * must be used with WhatsApp Business API template message — do NOT send free-form.
 */
export function buildWhatsAppMessage(
  output: ConversationOutput,
  options: {
    businessName: string;
    confirmationRequired: boolean;
    /** Production: use pre-approved templates only; payload will include templateName + templateParams */
    useTemplates?: boolean;
  }
): { text: string; flagged: boolean; high_priority: boolean; templateName?: string; templateParams?: Record<string, string> } {
  const flag = isLowConfidence(output);
  const urgent = isHumanFallback(output);
  const confidencePercent = (output.confidence * 100).toFixed(0);
  const data = {
    businessName: options.businessName,
    customerName: output.customer_name,
    phone: output.phone,
    serviceOrItems: output.service_or_items,
    timeRequested: output.time_requested,
    locationDetails: output.location_details,
    notes: output.notes,
    confidencePercent,
    flagged: flag,
  };

  if (options.useTemplates) {
    const templateName = getTemplateName(output.intent, urgent);
    const templateParams = getTemplateParams(templateName, { ...data, confidencePercent: confidencePercent + '%' });
    const text = getTemplateBodyForLog(templateName, data);
    return {
      text,
      flagged: flag,
      high_priority: urgent,
      templateName,
      templateParams,
    };
  }

  const lines: string[] = [
    `📞 New request — ${options.businessName}`,
    urgent ? '🔴 HIGH PRIORITY — Urgent callback requested.' : '',
    flag ? '⚠️ Low confidence — please verify with customer.' : '',
    `Intent: ${output.intent}`,
    `Name: ${output.customer_name}`,
    `Phone: ${output.phone}`,
    `Service/Items: ${output.service_or_items}`,
    `Time: ${output.time_requested}`,
    `Location: ${output.location_details}`,
    output.notes ? `Notes: ${output.notes}` : '',
    `Confidence: ${confidencePercent}%`,
  ].filter(Boolean);

  return {
    text: lines.join('\n'),
    flagged: flag,
    high_priority: urgent,
  };
}
