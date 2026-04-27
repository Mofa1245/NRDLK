# WhatsApp template lock (production)

WhatsApp requires **pre-approved templates** for business messages. Do not send free-form text in production.

## Template names (create these in Meta Business Manager)

| Constant | Template name | Use when |
|----------|---------------|----------|
| `BOOKING_TEMPLATE_V1` | `booking_confirmation_v1` | intent = booking, not urgent |
| `ORDER_TEMPLATE_V1` | `order_confirmation_v1` | intent = order, not urgent |
| `URGENT_CALLBACK_TEMPLATE_V1` | `urgent_callback_v1` | high_priority = true |

## Body parameters (placeholders)

Use these placeholder names when creating the templates in Meta so they match `getTemplateParams()`:

**booking_confirmation_v1**  
`business_name`, `customer_name`, `phone`, `service`, `time`, `location`, `notes`, `confidence`

**order_confirmation_v1**  
`business_name`, `customer_name`, `phone`, `items`, `time`, `location`, `notes`, `confidence`

**urgent_callback_v1**  
`business_name`, `customer_name`, `phone`, `summary`, `notes`

## Usage

1. Create the three templates in Meta Business Manager with the names and body variables above.
2. Set `config.useWhatsAppTemplates = true` for production.
3. Your WhatsApp sender must call the **template message** API with `templateName` and `templateParams` from the payload — do not send the free-form `message` field as the WhatsApp body.
