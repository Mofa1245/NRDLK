/**
 * Voice flow logic (implement in code):
 * on_call_start → greet → intent_detect loop → slot_fill loop → confirm_summary → emit_json → send_to_whatsapp → end_call
 */

export type VoiceFlowPhase =
  | 'on_call_start'
  | 'greet'
  | 'intent_detect'
  | 'slot_fill'
  | 'confirm_summary'
  | 'emit_json'
  | 'send_to_whatsapp'
  | 'end_call';

export interface VoiceFlowState {
  phase: VoiceFlowPhase;
  intentDetected: boolean;
  slotsFilled: boolean;
  summaryConfirmed: boolean;
  jsonEmitted: boolean;
  whatsappSent: boolean;
}

export function createInitialState(): VoiceFlowState {
  return {
    phase: 'on_call_start',
    intentDetected: false,
    slotsFilled: false,
    summaryConfirmed: false,
    jsonEmitted: false,
    whatsappSent: false,
  };
}

/** Ordered phases for the main flow (used by orchestrator or state machine). */
export const FLOW_PHASES: VoiceFlowPhase[] = [
  'on_call_start',
  'greet',
  'intent_detect',
  'slot_fill',
  'confirm_summary',
  'emit_json',
  'send_to_whatsapp',
  'end_call',
];

export function getNextPhase(current: VoiceFlowPhase): VoiceFlowPhase | null {
  const idx = FLOW_PHASES.indexOf(current);
  if (idx < 0 || idx >= FLOW_PHASES.length - 1) return null;
  return FLOW_PHASES[idx + 1];
}
