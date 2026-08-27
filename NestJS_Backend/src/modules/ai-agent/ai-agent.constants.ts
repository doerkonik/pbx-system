/**
 * Selectable Gemini speech-to-speech models for the AI voice agent.
 *
 * Kept to a short allow-list so a typo in the studio can never push a
 * non-existent model into the AVR container (which would silently break every
 * AI call). The first entry is the recommended default.
 */
export interface AiModelOption {
  value: string;
  label: string;
}

export const AI_MODELS: AiModelOption[] = [
  {
    value: 'gemini-2.5-flash-native-audio-preview-12-2025',
    label: 'Gemini 2.5 Flash — native audio (recommended)',
  },
  {
    value: 'gemini-2.0-flash-live-001',
    label: 'Gemini 2.0 Flash Live',
  },
];

export const AI_MODEL_VALUES = AI_MODELS.map((m) => m.value);

export const DEFAULT_AI_MODEL = AI_MODELS[0].value;

/** Supported spoken languages for the agent's default voice. */
export const AI_LANGUAGES = [
  { value: 'bn', label: 'Bangla' },
  { value: 'en', label: 'English' },
];

export const AI_LANGUAGE_VALUES = AI_LANGUAGES.map((l) => l.value);

/**
 * Gemini Live prebuilt voices. Empty value = the model's default voice.
 * (The container is patched to pass `speechConfig.voiceConfig` when GEMINI_VOICE
 * is set.) Gender is Google's characterisation; timbre is language-independent.
 */
export const AI_VOICES = [
  { value: '', label: 'Default (model default)' },
  { value: 'Aoede', label: 'Female — Aoede' },
  { value: 'Kore', label: 'Female — Kore' },
  { value: 'Leda', label: 'Female — Leda' },
  { value: 'Puck', label: 'Male — Puck' },
  { value: 'Charon', label: 'Male — Charon' },
  { value: 'Fenrir', label: 'Male — Fenrir' },
];

export const AI_VOICE_VALUES = AI_VOICES.map((v) => v.value);

/* --------------------------- Telephony / paths --------------------------- */

/** CDR userfield tag written on every AI-handled call, for analytics. */
export const AI_CDR_TAG = 'AI_AGENT';

/**
 * IVR menu key a caller presses to reach a human agent. The recorded
 * greeting must announce this same digit, so change both together.
 */
export const AGENT_MENU_DIGIT = '7';

/** Docker container/service names in the AVR stack. */
export const AVR_SERVICES = ['avr-core', 'avr-sts-gemini'] as const;
export type AvrService = (typeof AVR_SERVICES)[number];

/** Doer-writable dialplan file that /etc/asterisk/extensions.conf #includes. */
export const AVR_DIALPLAN_FILE =
  process.env.AVR_DIALPLAN_FILE ??
  '/home/doer/pbx/AVR-AI/asterisk/extensions_avr.conf';

/** Doer-readable dir where AI-call MixMonitor recordings are written. */
export const AVR_RECORDINGS_DIR =
  process.env.AVR_RECORDINGS_DIR ?? '/home/doer/pbx/AVR-AI/recordings';

/** AudioSocket endpoint the dialplan bridges AI calls into. */
export const AVR_AUDIOSOCKET = process.env.AVR_AUDIOSOCKET ?? '127.0.0.1:5001';
