import { enrichStructuredFromTranscript } from '../ai/heuristic-booking.js';

type Scenario = {
  id: string;
  transcript: string;
  expected: {
    number_of_people?: number;
    time?: string;
  };
};

const scenarios: Scenario[] = [
  { id: 'AR-01', transcript: 'حجز لشخصين الساعة 7', expected: { number_of_people: 2, time: '7' } },
  { id: 'AR-02', transcript: 'أبغى طاولة لست أشخاص 6.45', expected: { number_of_people: 6, time: '6:45' } },
  { id: 'AR-03', transcript: 'بكرة الساعة 8 لعائلة', expected: { time: '8' } },
  { id: 'AR-04', transcript: 'اليوم بعد المغرب لثلاثة', expected: { number_of_people: 3, time: 'after maghrib' } },
  { id: 'AR-05', transcript: 'السلام عليكم ابغى حجز 4 اشخاص الساعة 7 و 45 خارجي', expected: { number_of_people: 4, time: '7:45' } },
  { id: 'AR-06', transcript: 'بغيت احجي طاولة حق 6 شخص اليوم 7 الا 4', expected: { number_of_people: 6, time: '6:45' } },
  { id: 'AR-07', transcript: 'احجزلي خمسة اشخاص الساعة سبع إلا ربع', expected: { number_of_people: 5, time: '6:45' } },
  { id: 'AR-08', transcript: 'بدي طاولة ٣ اشخاص الساعة ٦ ونصف', expected: { number_of_people: 3, time: '6:30' } },
  { id: 'AR-09', transcript: 'ابي طاولة حق 10 اشخاص اليوم ساعة 6.45 خارجية', expected: { number_of_people: 10, time: '6:45' } },
  { id: 'AR-10', transcript: 'هلا اخوي ممكن حجز لاربعة بعد العشا', expected: { number_of_people: 4 } },
  { id: 'EN-01', transcript: 'table for 2 at 7', expected: { number_of_people: 2, time: '7' } },
  { id: 'EN-02', transcript: 'reservation for 5 at 6:30', expected: { number_of_people: 5, time: '6:30' } },
  { id: 'EN-03', transcript: 'book me 4 people 8pm', expected: { number_of_people: 4, time: '8pm' } },
  { id: 'EN-04', transcript: 'need a table for six around maghrib', expected: { number_of_people: 6, time: 'maghrib' } },
  { id: 'EN-05', transcript: 'book outdoor seating for 3 at 7.45pm', expected: { number_of_people: 3, time: '7:45pm' } },
  { id: 'MIX-01', transcript: 'حجز table for 2 الساعة 7', expected: { number_of_people: 2, time: '7' } },
  { id: 'MIX-02', transcript: 'reservation لخمسة أشخاص at 6.45', expected: { number_of_people: 5, time: '6:45' } },
  { id: 'MIX-03', transcript: 'ابي booking for family 6 people at 8:30', expected: { number_of_people: 6, time: '8:30' } },
  { id: 'NOISY-01', transcript: 'اهلا وسلام عليكم حسرات الشخص اليوم ساعة 6.45 ابيها خارجية', expected: { time: '6:45' } },
  { id: 'NOISY-02', transcript: 'شارك الشيخ اخوي بس بغيت احجي طاولة حق 6 شخص 7 الا 4', expected: { number_of_people: 6, time: '6:45' } },
];

function hasExpected(actual: unknown, expected: string): boolean {
  const a = String(actual || '').toLowerCase();
  const e = expected.toLowerCase();
  if (!e) return true;
  return a.includes(e);
}

function main() {
  let total_calls = 0;
  let first_pass_success = 0;
  let corrected_success = 0;
  let handoff_count = 0;

  console.log('[ACCEPTANCE MATRIX] v1');
  console.log(`Scenarios: ${scenarios.length}`);

  for (const s of scenarios) {
    total_calls += 1;
    const structured = enrichStructuredFromTranscript(s.transcript, { intent: 'unknown' });
    const finalBooking = {
      number_of_people: structured.number_of_people ?? null,
      time: structured.time ?? null,
      special_request: structured.special_request ?? null,
      intent: structured.intent ?? 'unknown',
    };

    const peopleOk =
      s.expected.number_of_people == null ||
      Number(finalBooking.number_of_people) === Number(s.expected.number_of_people);
    const timeOk = s.expected.time == null || hasExpected(finalBooking.time, s.expected.time);
    const pass = peopleOk && timeOk && finalBooking.intent === 'booking';
    const correctionNeeded = !pass;

    if (pass) {
      first_pass_success += 1;
    } else if (finalBooking.intent === 'booking') {
      corrected_success += 1;
    } else {
      handoff_count += 1;
    }

    console.log('\n---');
    console.log(`[${s.id}]`);
    console.log('transcript:', s.transcript);
    console.log('structured output:', JSON.stringify(structured));
    console.log('final booking:', JSON.stringify(finalBooking));
    console.log('was correction needed?:', correctionNeeded ? 'yes' : 'no');
  }

  const firstPassPct = total_calls ? ((first_pass_success / total_calls) * 100).toFixed(1) : '0.0';
  const recoveredPct = total_calls ? ((corrected_success / total_calls) * 100).toFixed(1) : '0.0';
  const failed_count = Math.max(0, total_calls - first_pass_success - corrected_success);
  const failedPct = total_calls ? ((failed_count / total_calls) * 100).toFixed(1) : '0.0';

  console.log('\n====================');
  console.log('Accuracy report:');
  console.log(`First pass: ${firstPassPct}%`);
  console.log(`Recovered: ${recoveredPct}%`);
  console.log(`Failed: ${failedPct}%`);
  console.log('\nCounters:');
  console.log(JSON.stringify({ total_calls, first_pass_success, corrected_success, handoff_count }, null, 2));
}

main();
