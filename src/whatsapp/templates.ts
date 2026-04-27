/**
 * Customer confirmation message template lock.
 * WhatsApp templates must be pre-approved and fixed structure.
 * Do NOT send free-form messages in production — use these template names + params only.
 */

export const BOOKING_TEMPLATE_V1 = 'booking_confirmation_v1';
export const ORDER_TEMPLATE_V1 = 'order_confirmation_v1';
export const URGENT_CALLBACK_TEMPLATE_V1 = 'urgent_callback_v1';

/** Fixed structure for WhatsApp Business API template message components */
export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  text?: string;
  parameters?: Array<{ type: 'text'; text: string }>;
}

export interface TemplateMessageSpec {
  name: string;
  language: string;
  components: TemplateComponent[];
}

/**
 * Map intent + high_priority to the locked template name.
 * Production senders must use sendTemplate(name, params) — not free-form text.
 */
export function getTemplateName(
  intent: string,
  highPriority: boolean
): string {
  if (highPriority) return URGENT_CALLBACK_TEMPLATE_V1;
  if (intent === 'booking') return BOOKING_TEMPLATE_V1;
  if (intent === 'order') return ORDER_TEMPLATE_V1;
  return BOOKING_TEMPLATE_V1; // fallback to booking for inquiry/callback/other
}

/**
 * Build template parameters for WhatsApp Business API.
 * These match the pre-approved template placeholders (body params in order).
 */
export function getTemplateParams(
  templateName: string,
  data: {
    businessName: string;
    customerName: string;
    phone: string;
    serviceOrItems: string;
    timeRequested: string;
    locationDetails: string;
    notes: string;
    confidencePercent: string;
    flagged?: boolean;
  }
): Record<string, string> {
  const p = data;
  switch (templateName) {
    case BOOKING_TEMPLATE_V1:
      return {
        business_name: p.businessName,
        customer_name: p.customerName,
        phone: p.phone,
        service: p.serviceOrItems,
        time: p.timeRequested,
        location: p.locationDetails,
        notes: p.notes || '—',
        confidence: p.confidencePercent,
      };
    case ORDER_TEMPLATE_V1:
      return {
        business_name: p.businessName,
        customer_name: p.customerName,
        phone: p.phone,
        items: p.serviceOrItems,
        time: p.timeRequested,
        location: p.locationDetails,
        notes: p.notes || '—',
        confidence: p.confidencePercent,
      };
    case URGENT_CALLBACK_TEMPLATE_V1:
      return {
        business_name: p.businessName,
        customer_name: p.customerName,
        phone: p.phone,
        summary: p.serviceOrItems || p.notes || '—',
        notes: p.notes || '—',
      };
    default:
      return {
        business_name: p.businessName,
        customer_name: p.customerName,
        phone: p.phone,
        details: p.serviceOrItems,
        notes: p.notes || '—',
      };
  }
}

/**
 * Human-readable body for logging or fallback (same structure as template body).
 * Use for outbound_queue message body when storing; actual send must use template API.
 */
export function getTemplateBodyForLog(
  templateName: string,
  data: {
    businessName: string;
    customerName: string;
    phone: string;
    serviceOrItems: string;
    timeRequested: string;
    locationDetails: string;
    notes: string;
    confidencePercent: string;
    flagged?: boolean;
  }
): string {
  const p = data;
  switch (templateName) {
    case BOOKING_TEMPLATE_V1:
      return [
        `📞 Booking — ${p.businessName}`,
        `Name: ${p.customerName}`,
        `Phone: ${p.phone}`,
        `Service: ${p.serviceOrItems}`,
        `Time: ${p.timeRequested}`,
        `Location: ${p.locationDetails}`,
        p.notes ? `Notes: ${p.notes}` : '',
        `Confidence: ${p.confidencePercent}%`,
      ].filter(Boolean).join('\n');
    case ORDER_TEMPLATE_V1:
      return [
        `📞 Order — ${p.businessName}`,
        `Name: ${p.customerName}`,
        `Phone: ${p.phone}`,
        `Items: ${p.serviceOrItems}`,
        `Time: ${p.timeRequested}`,
        `Location: ${p.locationDetails}`,
        p.notes ? `Notes: ${p.notes}` : '',
        `Confidence: ${p.confidencePercent}%`,
      ].filter(Boolean).join('\n');
    case URGENT_CALLBACK_TEMPLATE_V1:
      return [
        `🔴 URGENT CALLBACK — ${p.businessName}`,
        `Name: ${p.customerName}`,
        `Phone: ${p.phone}`,
        `Summary: ${p.serviceOrItems || p.notes || '—'}`,
        p.notes ? `Notes: ${p.notes}` : '',
      ].filter(Boolean).join('\n');
    default:
      return [
        `📞 Request — ${p.businessName}`,
        `Name: ${p.customerName}`,
        `Phone: ${p.phone}`,
        `Details: ${p.serviceOrItems}`,
        p.notes ? `Notes: ${p.notes}` : '',
      ].filter(Boolean).join('\n');
  }
}
