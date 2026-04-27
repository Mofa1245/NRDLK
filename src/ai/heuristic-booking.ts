/**
 * When LLM parse is unavailable or fails, extract booking hints from raw transcript
 * (English + light Arabic patterns) so WhatsApp/handoff reflect what was actually said.
 */

const WORD_NUM: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  a: 1,
  an: 1,
  couple: 2,
  pair: 2,
};

const AR_WORD_NUM: Record<string, number> = {
  واحد: 1,
  وحده: 1,
  وحدة: 1,
  اثنين: 2,
  اثنان: 2,
  اثنتين: 2,
  اثنينه: 2,
  اثنينة: 2,
  اثنينن: 2,
  ثلاثة: 3,
  ثلاثه: 3,
  ثلاث: 3,
  أربعة: 4,
  اربعة: 4,
  أربع: 4,
  اربع: 4,
  خمسة: 5,
  خمسه: 5,
  خمس: 5,
  ستة: 6,
  سته: 6,
  ست: 6,
  لست: 6,
  سبعة: 7,
  سبعه: 7,
  سبع: 7,
  ثمانية: 8,
  ثمانيه: 8,
  ثمان: 8,
  تسعة: 9,
  تسعه: 9,
  تسع: 9,
  عشرة: 10,
  عشره: 10,
  عشر: 10,
  عشرين: 20,
  عشرينن: 20,
  ثلاثين: 30,
  اربعين: 40,
  أربعين: 40,
  خمسين: 50,
};

function normalizeArabicDigits(text: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };
  return text.replace(/[٠-٩]/g, (d) => map[d] || d);
}

function normalizeArabicText(text: string): string {
  return normalizeArabicDigits(text)
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .trim();
}

function formatHourMinute(hour: number, minute: number): string | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function arabicPhraseToNumber(phrase: string): number | null {
  const p = normalizeArabicText(phrase).replace(/\s+/g, ' ').trim();
  if (!p) return null;
  if (/^\d{1,2}$/.test(p)) return parseInt(p, 10);
  if (Object.prototype.hasOwnProperty.call(AR_WORD_NUM, p)) return AR_WORD_NUM[p];

  // Composite words like "خمسة و اربعين" => 45
  if (p.includes(' و ')) {
    const parts = p.split(/\s+و\s+/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return null;
    let sum = 0;
    for (const part of parts) {
      if (/^\d{1,2}$/.test(part)) {
        sum += parseInt(part, 10);
        continue;
      }
      const mapped = AR_WORD_NUM[part];
      if (typeof mapped !== 'number') return null;
      sum += mapped;
    }
    return sum;
  }

  return null;
}

function parseArabicClockParts(
  hourStr: string,
  part2?: string | null,
  part3?: string | null,
): string | null {
  const hour = parseInt(hourStr, 10);
  const p2 = part2 != null ? parseInt(part2, 10) : NaN;
  const p3 = part3 != null ? parseInt(part3, 10) : NaN;

  if (!Number.isFinite(hour)) return null;

  // e.g. "الساعة 9 و 25"
  if (Number.isFinite(p2) && !Number.isFinite(p3)) {
    return formatHourMinute(hour, p2);
  }

  // e.g. noisy STT "الساعة 7 و 5 و 40" for 7:45
  if (Number.isFinite(p2) && Number.isFinite(p3)) {
    const sum = p2 + p3;
    if (sum >= 0 && sum < 60) return formatHourMinute(hour, sum);
    // If sum is invalid, prefer the last minute token.
    return formatHourMinute(hour, p3);
  }

  return null;
}

function parseArabicQuarterTo(hourExpr: string, quarterExpr: string): string | null {
  const hour = arabicPhraseToNumber(hourExpr);
  if (hour == null) return null;

  const qRaw = normalizeArabicText(quarterExpr).replace(/\s+/g, ' ').trim();
  const qNum = arabicPhraseToNumber(qRaw);
  const isQuarter =
    qRaw === 'ربع' ||
    qRaw === 'الربع' ||
    qNum === 15 ||
    // Common STT corruption: "الا 4" instead of "الا ربع".
    qNum === 4;

  if (!isQuarter) return null;
  const prevHour = (hour + 23) % 24;
  return formatHourMinute(prevHour, 45);
}

function parseArabicHourWithPeriod(hourExpr: string, periodExpr: string): string | null {
  const h = arabicPhraseToNumber(hourExpr);
  if (h == null) return null;

  const period = normalizeArabicText(periodExpr);
  if (!period) return null;

  // Keep human-friendly 12h display for WhatsApp templates.
  if (period.includes('مساء') || period === 'pm') {
    if (h >= 1 && h <= 12) return `${h}:00pm`;
    if (h > 12 && h <= 23) return `${h}:00`;
    return null;
  }

  if (period.includes('صباح') || period === 'am') {
    if (h >= 1 && h <= 12) return `${h}:00am`;
    if (h > 12 && h <= 23) return `${h}:00`;
    return null;
  }

  return null;
}

function isCoarseTimeValue(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const t = normalizeArabicText(v).toLowerCase();
  return (
    t === 'after maghrib' ||
    t.includes('بعد المغرب') ||
    t.includes('المغرب') ||
    t.includes('مساء') ||
    t.includes('تقريبا')
  );
}

function isExactTimeValue(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  if (!t) return false;
  if (isCoarseTimeValue(t)) return false;
  return /^\d{1,2}:\d{2}(am|pm)?$/.test(t) || /^\d{1,2}(am|pm)$/.test(t);
}

function extractPeople(text: string): number | null {
  const normalized = normalizeArabicDigits(text);
  const t = normalized.toLowerCase();
  const digit = t.match(/\b(\d{1,2})\s*(people|persons?|guests?|pax|of us)\b/);
  if (digit) return Math.min(99, parseInt(digit[1], 10));

  const word = t.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|couple|pair)\s+(people|persons?|guests?)\b/,
  );
  if (word) {
    const n = WORD_NUM[word[1]];
    if (typeof n === 'number') return n;
  }

  // English common phrasing: "table for two", "reservation for 4"
  const forWord = t.match(
    /\b(?:table|booking|reservation|book|reserve)?\s*(?:for|of)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|couple|pair)\b/,
  );
  if (forWord) {
    const n = WORD_NUM[forWord[1]];
    if (typeof n === 'number' && n > 0) return n;
  }
  const forDigit = t.match(/\b(?:table|booking|reservation|book|reserve)?\s*(?:for|of)\s+(\d{1,2})\b/);
  if (forDigit) return Math.min(99, parseInt(forDigit[1], 10));

  const arDigits = normalized.match(/(\d{1,2})\s*(أشخاص|اشخاص|شخص|اشخص|نفر|أفراد|افراد)/);
  if (arDigits) return Math.min(99, parseInt(arDigits[1], 10));

  const arWord = normalized.match(
    /(واحد|وحده|وحدة|اثنين|اثنان|اثنتين|اثنينه|اثنينة|اثنينن|ثلاثة|ثلاثه|ثلاث|أربعة|اربعة|أربع|اربع|خمسة|خمسه|خمس|ستة|سته|ست|لست|سبعة|سبعه|سبع|ثمانية|ثمانيه|ثمان|تسعة|تسعه|تسع|عشرة|عشره|عشر)\s*(أشخاص|اشخاص|شخص|اشخص|نفر|أفراد|افراد)/,
  );
  if (arWord) {
    const n = AR_WORD_NUM[arWord[1]];
    if (typeof n === 'number') return n;
  }

  return null;
}

function extractTime(text: string): string | null {
  const t = normalizeArabicDigits(text)
    .replace(/\b([ap])\.\s*m\./gi, '$1m')
    .replace(/\b([ap])\.m\b/gi, '$1m')
    .trim();
  const ar = normalizeArabicText(text);

  // Hour + minutes with : or . (e.g. 7:30pm, 7.30pm) — must run before bare hour pattern
  // so "7.30pm" does not incorrectly match as "30pm".
  let m = t.match(/\b([1-9]|1[0-2])[:.]([0-5]\d)\s*(am|pm)\b/i);
  if (m) {
    return `${m[1]}:${m[2]}${m[3].toLowerCase()}`;
  }

  // Bare hour + minutes without am/pm (e.g. 6.45, 18:30).
  m = t.match(/\b([0-1]?\d|2[0-3])[:.]([0-5]\d)\b/);
  if (m) {
    return `${m[1]}:${m[2]}`;
  }

  // Bare clock hour + am/pm only if hour is 1–12 (avoids matching "30pm" from "...7.30pm")
  m = t.match(/\b([1-9]|1[0-2])\s*(am|pm)\b/i);
  if (m) {
    return `${m[1]}${m[2].toLowerCase()}`;
  }

  // Arabic direct hour + period:
  // "الساعة ستة مساء", "ساعة 6 مساء", "الساعة 8 صباحا".
  m = ar.match(/(?:الساعة|ساعه|ساعة)\s+(.+?)\s*(مساء|المساء|صباح|الصباح|pm|am)\b/);
  if (m) {
    const parsed = parseArabicHourWithPeriod(m[1], m[2]);
    if (parsed) return parsed;
  }

  // Arabic explicit hour/minute in words or numbers:
  // "الساعة ستة وخمسة واربعين", "الساعة 6 و 45", "ساعة 6 وربع", "ساعة 6 ونصف"
  m = ar.match(/(?:الساعة|ساعه|ساعة)\s+(.+?)(?:\s+(?:المغرب|مساء|pm))?$/);
  if (m) {
    const tail = m[1].trim();
    let m2 = tail.match(/^(.+?)\s+(?:الا|الى)\s+(.+)$/);
    if (m2) {
      const parsed = parseArabicQuarterTo(m2[1], m2[2]);
      if (parsed) return parsed;
    }

    m2 = tail.match(/^(.+?)\s+و\s+(نصف|نص)$/);
    if (m2) {
      const hour = arabicPhraseToNumber(m2[1]);
      if (hour != null) {
        const formatted = formatHourMinute(hour, 30);
        if (formatted) return formatted;
      }
    }

    m2 = tail.match(/^(.+?)\s+و\s+ربع$/);
    if (m2) {
      const hour = arabicPhraseToNumber(m2[1]);
      if (hour != null) {
        const formatted = formatHourMinute(hour, 15);
        if (formatted) return formatted;
      }
    }

    m2 = tail.match(/^(.+?)\s+و\s+(.+)$/);
    if (m2) {
      const hour = arabicPhraseToNumber(m2[1]);
      const minute = arabicPhraseToNumber(m2[2]);
      if (hour != null && minute != null) {
        const formatted = formatHourMinute(hour, minute);
        if (formatted) return formatted;
      }
    }
  }

  // Arabic half-hour forms: "الساعة 6 ونصف", "6 ونص", "6 نصف", and attached-waw variants.
  m = ar.match(/(?:الساعة|ساعة|ساعه)?\s*([0-1]?\d|2[0-3]|[^\s]+)\s*(?:و\s*)?(?:نصف|نص)\b/);
  if (m) {
    const hh = arabicPhraseToNumber(m[1]);
    const formatted = hh == null ? null : formatHourMinute(hh, 30);
    if (formatted) return formatted;
  }

  // Arabic clock cues first: "الساعة 9 و 25", "ساعة 7 و 5 و 40".
  // Running this first avoids partial matches such as taking only "5 و 40".
  m = t.match(/(?:الساعة|ساعة|ساعه)\s*([0-1]?\d|2[0-3])(?:\s*و\s*([0-5]?\d))?(?:\s*و\s*([0-5]?\d))?/);
  if (m) {
    const parsed = parseArabicClockParts(m[1], m[2], m[3]);
    if (parsed) return parsed;
  }

  // Generic non-cued Arabic/neutral: "9 و 25", "9 و 5 و 20".
  // Negative lookahead prevents grabbing only the first pair out of a triple.
  m = t.match(/\b([0-1]?\d|2[0-3])\s*و\s*([0-5]?\d)(?:\s*و\s*([0-5]?\d))?\b/);
  if (m) {
    const parsed = parseArabicClockParts(m[1], m[2], m[3]);
    if (parsed) return parsed;
  }

  // Generic noisy variants without explicit "الساعة":
  // "7 الا 4", "7 الى ربع", "سبع الى ربع", "سبعة إلى 15".
  m = ar.match(
    /\b([0-1]?\d|2[0-3]|واحد|وحده|وحدة|اثنين|اثنان|اثنتين|ثلاثة|ثلاثه|ثلاث|أربعة|اربعة|أربع|اربع|خمسة|خمسه|خمس|ستة|سته|ست|سبعة|سبعه|سبع|ثمانية|ثمانيه|ثمان|تسعة|تسعه|تسع|عشرة|عشره|عشر)\s*(?:الا|الى)\s*(ربع|الربع|[0-9]{1,2})\b/,
  );
  if (m) {
    const parsed = parseArabicQuarterTo(m[1], m[2]);
    if (parsed) return parsed;
  }

  // Coarse Arabic time phrases when exact clock isn't captured by STT.
  if (/(بعد\s+المغرب|حدود\s+بعد\s+المغرب|المغرب)/.test(t)) {
    return 'after maghrib';
  }

  m = t.match(/\b(at\s+)?(\d{1,2})(?::(\d{2}))?\s*(in the evening|tonight|this evening)\b/i);
  if (m) {
    const h = m[2];
    const min = m[3];
    const hh = parseInt(h, 10);
    if (hh >= 1 && hh <= 23) {
      return min ? `${h}:${min} (evening)` : `${h} (evening)`;
    }
  }

  m = t.match(/\b(seven|eight|nine|ten|eleven|twelve)\s+(pm|am)\b/i);
  if (m) {
    const w = m[1].toLowerCase();
    const map: Record<string, string> = {
      seven: '7',
      eight: '8',
      nine: '9',
      ten: '10',
      eleven: '11',
      twelve: '12',
    };
    const h = map[w];
    if (h) return `${h}${m[2].toLowerCase()}`;
  }

  return null;
}

function detectBookingIntent(text: string): boolean {
  return /(book|booking|booked|reserve|reservation|table|طاولة|حجز|احجز|ابغى|بغيت|ابي)/i.test(text);
}

function extractSpecialRequest(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  const isOutdoor =
    /(outdoor|outside|outside table|terrace|garden|خارجي|خارجية|في الخارج|برع)/i.test(raw);
  const isIndoor =
    /(indoor|inside|inside table|داخلي|داخلية|في الداخل|جوه)/i.test(raw);
  const isPrivate =
    /(private room|vip|غرفة خاصة|غرفه خاصه|برايفت)/i.test(raw);
  const noSmoking =
    /(non[- ]?smoking|no smoking|غير مدخنين|بدون تدخين|بدون دخان)/i.test(raw);

  const tags: string[] = [];
  if (isOutdoor) tags.push('outdoor seating');
  if (isIndoor) tags.push('indoor seating');
  if (isPrivate) tags.push('private room');
  if (noSmoking) tags.push('non-smoking');

  // If no known marker, keep null to avoid polluting structured slots.
  if (!tags.length) return null;

  // Keep short, deterministic value; raw transcript is already persisted separately.
  return tags.join(', ');
}

/**
 * Fills missing structured fields from transcript without overwriting LLM values.
 */
export function enrichStructuredFromTranscript(transcript: string, structured: Record<string, unknown>): Record<string, unknown> {
  const raw = (transcript || '').trim();
  if (!raw) return structured;

  const out: Record<string, unknown> = { ...structured };
  let enriched = false;

  const people = extractPeople(raw);
  if (out.number_of_people == null && people != null) {
    out.number_of_people = people;
    enriched = true;
  }

  const time = extractTime(raw);
  if ((out.time == null || out.time === '') && time) {
    out.time = time;
    enriched = true;
  }

  if ((out.intent === 'unknown' || out.intent == null) && detectBookingIntent(raw)) {
    out.intent = 'booking';
    enriched = true;
  }

  if ((out.special_request == null || String(out.special_request).trim() === '')) {
    const special = extractSpecialRequest(raw);
    if (special) {
      out.special_request = special;
      enriched = true;
    }
  }

  if (enriched) {
    out._heuristic_enriched = true;
  }
  if (out.time != null) {
    out._time_exact = isExactTimeValue(out.time);
    out._time_coarse = isCoarseTimeValue(out.time);
  }

  return out;
}
