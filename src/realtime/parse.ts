import OpenAI from 'openai';

export async function parseRealtimeTranscript(transcript: string) {
  if (!transcript || transcript.length < 5) {
    return {
      intent: 'unknown',
      number_of_people: null,
      time: null,
      confidence: 0.2
    };
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
Extract structured booking info.

Transcript:
"${transcript}"

Return ONLY JSON:

{
  "intent": "booking | inquiry | unknown",
  "number_of_people": number or null,
  "time": string or null,
  "confidence": number between 0 and 1
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    const text = res.choices[0]?.message?.content || '';

    return JSON.parse(text);
  } catch (e) {
    console.error('[ERROR]', e);

    return {
      intent: 'unknown',
      number_of_people: null,
      time: null,
      confidence: 0.3
    };
  }
}
