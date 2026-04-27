export function shouldEscalate(structured: any, confidence: number | undefined, transcript: string) {
  if (!structured) return true;

  if (structured.intent === 'unknown') return true;

  if (confidence !== undefined && confidence < 0.7) return true;

  if (structured.flagged) return true;

  if (structured.number_of_people == null || structured.time == null || structured.time === '') {
    return true;
  }

  // Coarse time windows are not sufficient for auto-confirmation.
  if (structured._time_coarse === true) return true;

  if (!transcript || transcript.length < 10) return true;

  const normalized = transcript.replace(/\s+/g, '');
  if (normalized.length < 10) return true;
  const noisy = /(.)\1{12,}/u.test(normalized);
  if (noisy) return true;

  return false;
}

export function formatBusinessAlert({
  phone,
  transcript,
  structured,
  confidence,
}: {
  phone: string;
  transcript: string;
  structured: any;
  confidence: number | undefined;
}) {
  return `
🚨 HUMAN INTERVENTION REQUIRED

Customer: ${phone}

Transcript:
${transcript}

Parsed:
- Intent: ${structured?.intent}
- People: ${structured?.number_of_people}
- Time: ${structured?.time}
- Confidence: ${confidence}
`;
}

export function customerHandoffMessage() {
  return 'تم تحويل طلبك لموظف لخدمتك بشكل أفضل 🙏 سيتم التواصل معك قريباً.';
}
