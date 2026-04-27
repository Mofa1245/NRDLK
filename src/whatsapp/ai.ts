import OpenAI from 'openai';

export async function processMessage(
  state: { intent?: string | null; number_of_people?: number | null; time?: string | null },
  message: string
) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const prompt = `
You are a restaurant assistant in Qatar.

User message:
"${message}"

Current known data:
- intent: ${state.intent}
- people: ${state.number_of_people}
- time: ${state.time}

User already provided:
- people: ${state.number_of_people}
- time: ${state.time}

Return JSON:
{
  "intent": "...",
  "number_of_people": number | null,
  "time": "...",
  "reply": "natural Arabic response"
}
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    const text = res.choices[0]?.message?.content || '';

    try {
      return JSON.parse(text);
    } catch {
      return {
        intent: state.intent,
        number_of_people: state.number_of_people,
        time: state.time,
        reply: 'ممكن توضح أكثر؟'
      };
    }
  } catch (e) {
    console.error('[ERROR]', e);

    return {
      intent: state.intent,
      number_of_people: state.number_of_people,
      time: state.time,
      reply: 'حصل خطأ بسيط، نعيد المحاولة 🙏'
    };
  }
}
