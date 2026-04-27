import OpenAI from 'openai';

function fallbackStructured(transcript: string, reason?: string) {
  return {
    intent: 'unknown' as const,
    number_of_people: null as null,
    time: null as null,
    raw: transcript,
    confidence: 0.45,
    _parse_fallback: true as const,
    ...(reason ? { _parse_fallback_reason: reason } : {}),
  };
}

/**
 * Structured extraction via OpenAI. On quota/network/key errors, returns a safe
 * object so callers still ship the raw Whisper transcript (e.g. WhatsApp).
 */
/**
 * @param ivrLang Optional: which prompt language they heard first — does NOT limit spoken language.
 */
export async function parseTranscript(transcript: string, ivrLang?: 'en' | 'ar') {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    console.warn('[parseTranscript] OPENAI_API_KEY unset — skipping LLM parse');
    return fallbackStructured(transcript, 'no_api_key');
  }

  const menuContext =
    ivrLang === 'en'
      ? 'IVR played English prompts first (caller may still speak Arabic or mix languages).'
      : ivrLang === 'ar'
        ? 'IVR played Arabic prompts first (caller may still speak English or mix languages).'
        : 'Language on the call may be Arabic, English, or mixed.';

  try {
    const openai = new OpenAI({ apiKey: key });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `
You help restaurants in Qatar extract structured booking/order intent from phone transcripts.

This service is bilingual. Transcripts may be Arabic (including Gulf dialect), English, or code-mixed — handle all of them.
${menuContext}

You understand messy speech, incomplete sentences, and repeated words.

Your job:
Understand what the customer wants.

Extract:
- intent (booking / order / other)
- number_of_people (if mentioned)
- time (if mentioned)

If something is unclear, return null.

Return ONLY JSON.
        `,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    });

    const text = response.choices[0]?.message?.content?.trim() || '';

    try {
      return JSON.parse(text);
    } catch {
      return fallbackStructured(transcript, 'invalid_json');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[parseTranscript] OpenAI failed — using raw transcript fallback:', msg);
    return fallbackStructured(transcript, 'openai_error');
  }
}
