import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AI_LANGUAGE_VALUES,
  AI_MODEL_VALUES,
  AI_VOICE_VALUES,
  AVR_SERVICES,
} from '../ai-agent.constants';

/**
 * Update the AI-agent studio configuration. Every field is optional so the
 * studio can send a partial patch; the service merges over the current row.
 * Secrets are never accepted here — the Gemini key is set only via publish.
 */
export class UpdateAiAgentConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  agentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  businessDescription?: string;

  @IsOptional()
  @IsIn(AI_LANGUAGE_VALUES)
  language?: string;

  @IsOptional()
  @IsBoolean()
  allowEnglish?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  personality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  businessFacts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fallbackBehavior?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greeting?: string;

  @IsOptional()
  @IsIn(AI_MODEL_VALUES)
  model?: string;

  @IsOptional()
  @IsIn(AI_VOICE_VALUES)
  voice?: string;
}

/**
 * Publish the current config to the live AVR container. Optionally rotates the
 * Gemini API key (write-only — it is stored in the AVR `.env`, never the DB and
 * never returned to the client).
 */
export class PublishAiAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;
}

/**
 * Telephony (dial-plan) settings for the AI agent. Applying these regenerates
 * the AVR dialplan file and reloads Asterisk over AMI.
 */
export class UpdateAiTelephonyDto {
  /** Internal extension that dials straight to the AI (2–6 digits). */
  @IsOptional()
  @Matches(/^[0-9]{2,6}$/, { message: 'aiExten must be 2-6 digits' })
  aiExten?: string;

  /** Agents to ring on "press 3", '&'-joined extensions (e.g. "102&103"). */
  @IsOptional()
  @Matches(/^[0-9]{2,6}(&[0-9]{2,6})*$/, {
    message: 'press3Agents must be &-joined extensions, e.g. 102&103',
  })
  press3Agents?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  ringSeconds?: number;

  @IsOptional()
  @IsBoolean()
  recordCalls?: boolean;
}

/** Restart one AVR container (or both when omitted). */
export class RestartAvrDto {
  @IsOptional()
  @IsIn(AVR_SERVICES as unknown as string[])
  service?: string;
}

/** Supervisor listen-in on a live AI call. */
export class ListenDto {
  @IsString()
  @MaxLength(120)
  channel: string;

  @IsIn(['listen', 'whisper', 'barge'])
  mode: string;
}

/** One transcript segment posted by the AVR container during a call. */
export class IngestTranscriptDto {
  @IsString()
  @MaxLength(80)
  audiosocketId: string;

  @IsIn(['caller', 'ai'])
  role: string;

  @IsString()
  @MaxLength(4000)
  text: string;
}
