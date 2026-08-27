import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, createReadStream } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { AiAgentConfig, AiCallReview, Cdr } from '../../database/entities';
import { TelephonyService } from '../../telephony/telephony.service';
import { AmiService } from '../../telephony/ami.service';
import {
  AI_CDR_TAG,
  AI_LANGUAGES,
  AI_MODELS,
  AI_VOICES,
  AVR_AUDIOSOCKET,
  AVR_DIALPLAN_FILE,
  AVR_RECORDINGS_DIR,
  AVR_SERVICES,
  DEFAULT_AI_MODEL,
  AGENT_MENU_DIGIT,
} from './ai-agent.constants';
import {
  PublishAiAgentDto,
  UpdateAiAgentConfigDto,
  UpdateAiTelephonyDto,
} from './dto/ai-agent.dto';

const execFileP = promisify(execFile);

/** Directory holding the AVR docker-compose stack + its `.env`. */
const AVR_DIR = process.env.AVR_DIR ?? '/home/doer/pbx/AVR-AI/avr-infra';
/** The speech-to-speech container whose env carries the persona + model. */
const STS_SERVICE = process.env.AVR_STS_SERVICE ?? 'avr-sts-gemini';
/** PATH augmented so the `docker` CLI resolves under pm2's slim environment. */
const DOCKER_ENV = {
  ...process.env,
  PATH: `${process.env.PATH ?? ''}:/usr/local/bin:/usr/bin:/bin`,
};
/** Shared secret the AVR container must present to POST transcript segments.
 *  Read lazily: dotenv loads AFTER this module is imported in main.ts. */
const ingestSecret = (): string => process.env.AI_INGEST_SECRET ?? '';
/** Text model used for auto-CSAT scoring (Gemini generateContent, free tier). */
const csatModel = (): string =>
  process.env.AI_CSAT_MODEL ?? 'gemini-flash-latest';

export interface AiAgentStatus {
  apiKeySet: boolean;
  containerRunning: boolean;
  avrDir: string;
}

export interface AiAgentConfigView extends AiAgentConfig {
  compiledPreview: string;
  status: AiAgentStatus;
  models: typeof AI_MODELS;
  languages: typeof AI_LANGUAGES;
  voices: typeof AI_VOICES;
}

export interface ContainerHealth {
  service: string;
  status: string; // running | exited | absent | ...
  uptimeSec: number | null;
  image: string | null;
  cpuPerc: string | null;
  memUsage: string | null;
}

/**
 * AI Studio. Owns the single-row studio config and the live AVR agent:
 *  - persona/model/voice → written to the AVR `.env`, container recreated;
 *  - dial-plan settings   → written to a doer-owned included dialplan file,
 *                           reloaded over AMI (backend cannot touch /etc/asterisk);
 *  - container health / logs / restart via `sg docker` (pm2 lacks the group);
 *  - AI-call analytics from the CDR rows tagged in the dialplan.
 * No secrets are ever persisted in the database.
 */
export interface LiveAiCall {
  uniqueid: string;
  channel: string;
  caller: string;
  audiosocketId: string;
  startedAt: number;
}

interface TranscriptSeg {
  role: 'caller' | 'ai';
  text: string;
}

@Injectable()
export class AiAgentService implements OnModuleInit {
  private readonly logger = new Logger(AiAgentService.name);

  /** uniqueid -> live AI call, kept in sync from the AMI event stream. */
  private readonly liveCalls = new Map<string, LiveAiCall>();
  /** AudioSocket session id -> uniqueid, to correlate transcript posts. */
  private readonly audioToUid = new Map<string, string>();
  /** uniqueid -> transcript segments accumulated during the call. */
  private readonly transcriptBuf = new Map<string, TranscriptSeg[]>();

  constructor(
    @InjectRepository(AiAgentConfig)
    private readonly repo: Repository<AiAgentConfig>,
    @InjectRepository(Cdr)
    private readonly cdr: Repository<Cdr>,
    @InjectRepository(AiCallReview)
    private readonly reviews: Repository<AiCallReview>,
    private readonly telephony: TelephonyService,
    private readonly ami: AmiService,
  ) {}

  /** Subscribe to the AMI event stream to track live AI calls. */
  onModuleInit(): void {
    this.ami.on('event', (ev: Record<string, any>) => this.onAmiEvent(ev));
  }

  private onAmiEvent(ev: Record<string, any>): void {
    if (ev.Event === 'UserEvent') {
      const uid = ev.Uniqueid ?? ev.UniqueID;
      if (!uid) return;
      if (ev.UserEvent === 'AICallStart') {
        const audiosocketId = ev.AudioSocketId ?? '';
        this.liveCalls.set(uid, {
          uniqueid: uid,
          channel: ev.Channel ?? '',
          caller: ev.CallerIDNum ?? ev.Caller ?? '',
          audiosocketId,
          startedAt: Math.floor(Date.now() / 1000),
        });
        if (audiosocketId) this.audioToUid.set(audiosocketId, uid);
        this.transcriptBuf.set(uid, []);
      } else if (ev.UserEvent === 'AICallEnd') {
        this.endCall(uid);
      }
    } else if (ev.Event === 'Hangup') {
      // Safety net: end the call even if the hangup handler didn't fire.
      const uid = ev.Uniqueid ?? ev.UniqueID;
      if (uid) this.endCall(uid);
    }
  }

  /** Drop live state and, if any transcript was captured, finalize the review. */
  private endCall(uid: string): void {
    const live = this.liveCalls.get(uid);
    this.liveCalls.delete(uid);
    if (live?.audiosocketId) this.audioToUid.delete(live.audiosocketId);
    const segs = this.transcriptBuf.get(uid);
    this.transcriptBuf.delete(uid);
    if (segs && segs.length > 0) {
      // Fire-and-forget: never block the AMI event loop on the LLM call.
      void this.finalizeCall(uid, live?.caller ?? '', segs);
    }
  }

  /* ------------------------------ read ------------------------------ */

  async getOrCreate(): Promise<AiAgentConfig> {
    // TypeORM 0.3 requires a where in findOne; take the first row via find().
    const [existing] = await this.repo.find({
      order: { createdAt: 'ASC' },
      take: 1,
    });
    let cfg = existing;
    if (!cfg) {
      cfg = this.repo.create({
        agentName: 'Assistant',
        organizationName: '',
        businessDescription: null,
        language: 'bn',
        allowEnglish: true,
        personality: 'Be warm, polite, patient and concise.',
        businessFacts: null,
        fallbackBehavior:
          'If you cannot help or the caller asks for a person, tell them you will connect them to a human agent, then stop.',
        greeting: null,
        model: DEFAULT_AI_MODEL,
        voice: '',
        aiExten: '8888',
        press3Agents: '102&103',
        ringSeconds: 5,
        recordCalls: true,
        published: false,
      });
      cfg.compiledInstructions = this.compile(cfg);
      cfg = await this.repo.save(cfg);
    }
    return cfg;
  }

  async getView(): Promise<AiAgentConfigView> {
    const cfg = await this.getOrCreate();
    const status = await this.status();
    return {
      ...cfg,
      compiledPreview: this.compile(cfg),
      status,
      models: AI_MODELS,
      languages: AI_LANGUAGES,
      voices: AI_VOICES,
    };
  }

  async status(): Promise<AiAgentStatus> {
    return {
      apiKeySet: await this.hasApiKey(),
      containerRunning: await this.containerRunning(),
      avrDir: AVR_DIR,
    };
  }

  /* --------------------------- persona/write ------------------------ */

  async update(dto: UpdateAiAgentConfigDto): Promise<AiAgentConfigView> {
    const cfg = await this.getOrCreate();

    if (dto.agentName !== undefined) cfg.agentName = dto.agentName.trim();
    if (dto.organizationName !== undefined)
      cfg.organizationName = dto.organizationName.trim();
    if (dto.businessDescription !== undefined)
      cfg.businessDescription = dto.businessDescription || null;
    if (dto.language !== undefined) cfg.language = dto.language;
    if (dto.allowEnglish !== undefined) cfg.allowEnglish = dto.allowEnglish;
    if (dto.personality !== undefined) cfg.personality = dto.personality || null;
    if (dto.businessFacts !== undefined)
      cfg.businessFacts = dto.businessFacts || null;
    if (dto.fallbackBehavior !== undefined)
      cfg.fallbackBehavior = dto.fallbackBehavior || null;
    if (dto.greeting !== undefined) cfg.greeting = dto.greeting || null;
    if (dto.model !== undefined) cfg.model = dto.model;
    if (dto.voice !== undefined) cfg.voice = dto.voice;

    cfg.published = false;
    cfg.compiledInstructions = this.compile(cfg);
    await this.repo.save(cfg);

    return this.getView();
  }

  async publish(dto: PublishAiAgentDto): Promise<AiAgentConfigView> {
    const cfg = await this.getOrCreate();
    const instructions = this.compile(cfg);

    await this.writeAvrEnv(
      instructions,
      cfg.model,
      cfg.voice,
      dto.apiKey?.trim(),
    );
    await this.recreateContainer();

    cfg.compiledInstructions = instructions;
    cfg.published = true;
    cfg.lastPublishedAt = new Date();
    await this.repo.save(cfg);

    this.logger.log(
      `AI agent published: model=${cfg.model} voice=${cfg.voice || 'default'}`,
    );
    return this.getView();
  }

  /* --------------------------- telephony ---------------------------- */

  /** Save dial-plan settings and apply them (regenerate dialplan + reload). */
  async updateTelephony(dto: UpdateAiTelephonyDto): Promise<AiAgentConfigView> {
    const cfg = await this.getOrCreate();
    if (dto.aiExten !== undefined) cfg.aiExten = dto.aiExten;
    if (dto.press3Agents !== undefined) cfg.press3Agents = dto.press3Agents;
    if (dto.ringSeconds !== undefined) cfg.ringSeconds = dto.ringSeconds;
    if (dto.recordCalls !== undefined) cfg.recordCalls = dto.recordCalls;
    await this.repo.save(cfg);

    await this.applyDialplan(cfg);
    return this.getView();
  }

  /**
   * Write the generated dialplan to the doer-owned included file, then reload
   * Asterisk over AMI. Backs up the previous file and restores it if the reload
   * fails, so a bad apply can never leave the IVR broken.
   */
  private async applyDialplan(cfg: AiAgentConfig): Promise<void> {
    const content = this.generateDialplan(cfg);
    const file = AVR_DIALPLAN_FILE;
    const bak = `${file}.bak`;

    let previous: string | null = null;
    try {
      previous = await fsp.readFile(file, 'utf8');
    } catch {
      previous = null;
    }

    const tmp = `${file}.tmp`;
    try {
      await fsp.writeFile(tmp, content, { mode: 0o644 });
      await fsp.rename(tmp, file);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Cannot write dialplan file ${file}: ${(err as Error).message}`,
      );
    }

    try {
      await this.telephony.rawAction({
        Action: 'Command',
        Command: 'dialplan reload',
      });
    } catch (err) {
      // Reload failed → restore the previous dialplan and reload again.
      if (previous !== null) {
        await fsp.writeFile(file, previous, { mode: 0o644 }).catch(() => {});
        await this.telephony
          .rawAction({ Action: 'Command', Command: 'dialplan reload' })
          .catch(() => {});
      }
      throw new ServiceUnavailableException(
        `Dialplan reload failed, rolled back: ${(err as Error).message}`,
      );
    }

    // Keep a backup of the last-good dialplan for manual recovery.
    await fsp.writeFile(bak, content, { mode: 0o644 }).catch(() => {});
    this.logger.log(
      `AI dialplan applied: exten=${cfg.aiExten} press3=${cfg.press3Agents} ring=${cfg.ringSeconds}s record=${cfg.recordCalls}`,
    );
  }

  /** Build the AVR + IVR dialplan from the config (safe, validated inputs). */
  private generateDialplan(cfg: AiAgentConfig): string {
    const dialAgents = cfg.press3Agents
      .split('&')
      .filter(Boolean)
      .map((a) => `PJSIP/${a}`)
      .join('&');
    const as = AVR_AUDIOSOCKET;
    const rec = cfg.recordCalls
      ? ` same => n,MixMonitor(${AVR_RECORDINGS_DIR}/ai-\${UNIQUEID}.wav)\n`
      : '';

    return `; =============================================================================
;  AI Voice Agent (AVR) + Call-center IVR
;  AUTO-GENERATED by the AI Studio dashboard — do not edit by hand.
;  Included from /etc/asterisk/extensions.conf.
; =============================================================================

; ---- AudioSocket bridge to the AI (GoSub avr,s,1(host:port)) ----
[avr]
exten => s,1,NoOp(AVR AI agent -> \${ARG1})
 same => n,Answer()
 same => n,Wait(1)
 same => n,Set(CDR(userfield)=${AI_CDR_TAG})
 same => n,Set(UUID=\${SHELL(uuidgen | tr -d '\\n')})
 same => n,Set(CHANNEL(hangup_handler_push)=avr-hangup,s,1)
 same => n,UserEvent(AICallStart,AudioSocketId: \${UUID})
${rec} same => n,Dial(AudioSocket/\${ARG1}/\${UUID})
 same => n,Return()

; Fires an AMI UserEvent when the AI call ends (hangup handler) so the
; dashboard's live list clears the entry.
[avr-hangup]
exten => s,1,NoOp(AI call \${UNIQUEID} ended)
 same => n,UserEvent(AICallEnd)
 same => n,Return()

; ---- Inbound call-center IVR ----
[ivr-main]
exten => s,1,NoOp(Call center IVR entry, DID=\${EXTEN})
 same => n,Answer()
 same => n,Wait(1)
 same => n,Set(IVRTRIES=0)
 same => n(menu),Set(IVRTRIES=$[\${IVRTRIES}+1])
 same => n,GotoIf($[\${IVRTRIES}>3]?toai)
 same => n,Background(custom/ivr-greeting)
 same => n,WaitExten(7)
 same => n,Goto(menu)
 same => n(toai),NoOp(No selection -> AI agent)
 same => n,GoSub(avr,s,1(${as}))
 same => n,Hangup()

; Press ${AGENT_MENU_DIGIT} -> ring agents ${cfg.ringSeconds}s with hold music, else AI
exten => ${AGENT_MENU_DIGIT},1,NoOp(Caller pressed ${AGENT_MENU_DIGIT} -> ring agents)
 same => n,Dial(${dialAgents},${cfg.ringSeconds},m)
 same => n,NoOp(Agents did not answer: \${DIALSTATUS} -> AI)
 same => n,GoSub(avr,s,1(${as}))
 same => n,Hangup()

exten => i,1,Goto(s,menu)
exten => t,1,Goto(s,toai)

; ---- Direct-to-AI entry (for a DID that should skip the IVR) ----
[ai-agent]
exten => _.,1,NoOp(Direct inbound to AI agent, DID=\${EXTEN})
 same => n,GoSub(avr,s,1(${as}))
 same => n,Hangup()

; ---- Internal test extension: dial ${cfg.aiExten} to reach the AI ----
[from-internal]
exten => ${cfg.aiExten},1,NoOp(=== AI voice agent test ===)
 same => n,GoSub(avr,s,1(${as}))
 same => n,Hangup()
`;
  }

  /* --------------------------- containers --------------------------- */

  private sgDocker(innerCmd: string, timeout: number) {
    return execFileP('sg', ['docker', '-c', innerCmd], {
      timeout,
      env: DOCKER_ENV,
    });
  }

  /** Per-container health (status, uptime, image, cpu, mem). */
  async health(): Promise<ContainerHealth[]> {
    const out: ContainerHealth[] = [];
    for (const service of AVR_SERVICES) {
      const h: ContainerHealth = {
        service,
        status: 'absent',
        uptimeSec: null,
        image: null,
        cpuPerc: null,
        memUsage: null,
      };
      try {
        const { stdout } = await this.sgDocker(
          `docker inspect -f '{{.State.Status}}|{{.State.StartedAt}}|{{.Config.Image}}' ${service}`,
          8_000,
        );
        const [st, started, image] = stdout.trim().split('|');
        h.status = st || 'absent';
        h.image = image || null;
        if (started) {
          const ms = Date.now() - Date.parse(started);
          h.uptimeSec = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : null;
        }
      } catch {
        out.push(h);
        continue;
      }
      try {
        const { stdout } = await this.sgDocker(
          `docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}' ${service}`,
          12_000,
        );
        const [cpu, mem] = stdout.trim().split('|');
        h.cpuPerc = cpu || null;
        h.memUsage = mem || null;
      } catch {
        /* stats unavailable while restarting — leave null */
      }
      out.push(h);
    }
    return out;
  }

  /** Tail of a container's logs. */
  async logs(service: string, lines: number): Promise<{ service: string; logs: string }> {
    if (!AVR_SERVICES.includes(service as never)) {
      throw new BadRequestException('Unknown AVR service');
    }
    const n = Math.min(500, Math.max(10, Math.floor(lines) || 100));
    try {
      const { stdout, stderr } = await this.sgDocker(
        `docker logs --tail ${n} ${service} 2>&1`,
        12_000,
      );
      return { service, logs: (stdout || stderr || '').slice(-40_000) };
    } catch (err) {
      throw new ServiceUnavailableException(
        `Cannot read logs: ${(err as Error).message}`,
      );
    }
  }

  /** Restart one AVR container, or both when service is omitted. */
  async restart(service?: string): Promise<{ restarted: string[] }> {
    const targets =
      service && AVR_SERVICES.includes(service as never)
        ? [service]
        : [...AVR_SERVICES];
    try {
      await this.sgDocker(`docker restart ${targets.join(' ')}`, 60_000);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Restart failed: ${(err as Error).message}`,
      );
    }
    this.logger.log(`AVR restarted: ${targets.join(', ')}`);
    return { restarted: targets };
  }

  /* --------------------------- analytics ---------------------------- */

  async analytics(days = 14): Promise<Record<string, unknown>> {
    const span = Math.min(90, Math.max(1, Math.floor(days) || 14));
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const since = new Date(startToday);
    since.setDate(since.getDate() - (span - 1));

    const base = () =>
      this.cdr.createQueryBuilder('r').where('r.userfield = :tag', {
        tag: AI_CDR_TAG,
      });

    const [total, answered, today] = await Promise.all([
      base().getCount(),
      base().andWhere("r.disposition = 'ANSWERED'").getCount(),
      base().andWhere('r.calldate >= :s', { s: startToday }).getCount(),
    ]);

    const durAgg = await base()
      .select('COALESCE(SUM(r.billsec),0)', 'totalBill')
      .addSelect('COALESCE(AVG(r.billsec),0)', 'avgBill')
      .getRawOne<{ totalBill: string; avgBill: string }>();

    const seriesRaw = await base()
      .andWhere('r.calldate >= :since', { since })
      .select("to_char(date_trunc('day', r.calldate), 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(*)', 'count')
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; count: string }>();

    // Fill missing days with 0 so the chart is continuous.
    const counts = new Map(seriesRaw.map((r) => [r.day, Number(r.count)]));
    const series: { day: string; count: number }[] = [];
    for (let i = 0; i < span; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ day: key, count: counts.get(key) ?? 0 });
    }

    const recentRows = await base()
      .orderBy('r.calldate', 'DESC')
      .addOrderBy('r.id', 'DESC')
      .take(25)
      .getMany();

    const uids = recentRows.map((r) => r.uniqueid).filter(Boolean);
    const revs = uids.length
      ? await this.reviews.find({ where: { uniqueid: In(uids) } })
      : [];
    const revByUid = new Map(revs.map((r) => [r.uniqueid, r]));

    const recent = recentRows.map((r) => {
      const rev = revByUid.get(r.uniqueid);
      return {
        uniqueid: r.uniqueid,
        calldate: r.calldate,
        src: r.src,
        dst: r.dst,
        duration: r.duration,
        billsec: r.billsec,
        disposition: r.disposition,
        hasRecording: this.recordingExists(r.uniqueid),
        hasTranscript: !!rev,
        csatScore: rev?.csatScore ?? null,
        csatLabel: rev?.csatLabel ?? null,
      };
    });

    return {
      totals: {
        total,
        answered,
        today,
        totalBillsec: Number(durAgg?.totalBill ?? 0),
        avgBillsec: Math.round(Number(durAgg?.avgBill ?? 0)),
      },
      series,
      recent,
      spanDays: span,
    };
  }

  /* ----------------------- live supervision ------------------------ */

  /** Currently-active AI calls (from the AMI UserEvent stream). */
  async listLive(): Promise<(LiveAiCall & { durationSec: number })[]> {
    const now = Math.floor(Date.now() / 1000);
    return [...this.liveCalls.values()]
      .map((c) => ({ ...c, durationSec: Math.max(0, now - c.startedAt) }))
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Supervisor listen-in on a live AI call via ChanSpy, originated to the
   * supervisor's own extension. Only channels currently registered as AI calls
   * may be targeted. Modes: listen (silent), whisper (to caller), barge (both).
   */
  async listen(
    channel: string,
    mode: string,
    supervisorExtension: string | null,
  ): Promise<{ ok: true }> {
    if (!supervisorExtension) {
      throw new BadRequestException(
        'Your account has no extension. Log in as a user with an extension (softphone) to listen.',
      );
    }
    const live = await this.listLive();
    if (!live.some((c) => c.channel === channel)) {
      throw new NotFoundException('That AI call is no longer active.');
    }
    const opts =
      mode === 'whisper' ? 'qw' : mode === 'barge' ? 'qB' : 'q';
    await this.telephony.rawAction({
      Action: 'Originate',
      Channel: `PJSIP/${supervisorExtension}`,
      Application: 'ChanSpy',
      Data: `${channel},${opts}`,
      CallerID: `Listen <${supervisorExtension}>`,
      Async: 'true',
    });
    this.logger.log(
      `AI listen (${mode}): ${supervisorExtension} -> ${channel}`,
    );
    return { ok: true };
  }

  /* ----------------------- transcripts + CSAT ---------------------- */

  /**
   * Accept a transcript segment posted by the AVR container. Guarded by a
   * shared secret. Correlates the AudioSocket session id to the live call and
   * buffers the segment until the call ends.
   */
  ingestTranscript(
    secret: string,
    audiosocketId: string,
    role: string,
    text: string,
  ): void {
    const expected = ingestSecret();
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Bad ingest secret');
    }
    const uid = this.audioToUid.get(audiosocketId);
    if (!uid) return; // unknown/ended session — drop silently
    const buf = this.transcriptBuf.get(uid);
    if (!buf) return;
    const t = (text ?? '').toString();
    if (!t.trim()) return;
    buf.push({ role: role === 'ai' ? 'ai' : 'caller', text: t });
    if (buf.length > 2000) buf.splice(0, buf.length - 2000); // bound memory
  }

  /** Join segments into readable "Caller:/AI:" turns. */
  private joinSegments(segs: TranscriptSeg[]): string {
    const lines: string[] = [];
    let role: string | null = null;
    let cur = '';
    const flush = () => {
      const t = cur.trim();
      if (t) lines.push(`${role === 'ai' ? 'AI' : 'Caller'}: ${t}`);
      cur = '';
    };
    for (const s of segs) {
      if (s.role !== role) {
        flush();
        role = s.role;
      }
      cur += s.text;
    }
    flush();
    return lines.join('\n');
  }

  /** Build the transcript, score CSAT, and persist one review row. */
  private async finalizeCall(
    uid: string,
    caller: string,
    segs: TranscriptSeg[],
  ): Promise<void> {
    try {
      const transcript = this.joinSegments(segs);
      let csatScore: number | null = null;
      let csatLabel: string | null = null;
      let summary: string | null = null;
      try {
        const r = await this.runCsat(transcript);
        csatScore = r.score;
        csatLabel = r.label;
        summary = r.summary;
      } catch (e) {
        this.logger.warn(`CSAT failed for ${uid}: ${(e as Error).message}`);
      }
      await this.reviews.save(
        this.reviews.create({
          uniqueid: uid,
          caller,
          transcript,
          csatScore,
          csatLabel,
          summary,
        }),
      );
      this.logger.log(
        `AI review saved: ${uid} csat=${csatScore ?? '-'} (${segs.length} segs)`,
      );
    } catch (e) {
      this.logger.error(`finalizeCall ${uid} failed: ${(e as Error).message}`);
    }
  }

  /** Ask Gemini (text) to score satisfaction + summarize. Returns nulls on failure. */
  private async runCsat(
    transcript: string,
  ): Promise<{ score: number | null; label: string | null; summary: string | null }> {
    const empty = { score: null, label: null, summary: null };
    const key = await this.getApiKey();
    if (!key || !transcript.trim()) return empty;

    const prompt =
      'You are analyzing a phone-call transcript between a caller and an AI ' +
      'support agent (may be Bangla or English). Respond with ONLY a JSON ' +
      'object: {"score": <integer 1-5, caller satisfaction, 5=very satisfied>, ' +
      '"label": "satisfied"|"neutral"|"unsatisfied", "summary": "<one short ' +
      'English sentence>"}.\n\nTranscript:\n' + transcript.slice(0, 8000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${csatModel()}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini CSAT HTTP ${res.status}`);
    const data: any = await res.json();
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    let parsed: any;
    try {
      parsed = JSON.parse(textOut);
    } catch {
      return empty;
    }
    const score = Number.isFinite(Number(parsed.score))
      ? Math.min(5, Math.max(1, Math.round(Number(parsed.score))))
      : null;
    const label =
      typeof parsed.label === 'string' ? parsed.label.slice(0, 20) : null;
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : null;
    return { score, label, summary };
  }

  private async getApiKey(): Promise<string | null> {
    try {
      const raw = await fsp.readFile(this.envPath(), 'utf8');
      const m = raw.match(/^GEMINI_API_KEY=(.*)$/m);
      return m && m[1].trim() ? m[1].trim() : null;
    } catch {
      return null;
    }
  }

  /** The stored review (transcript + CSAT) for a finished AI call. */
  async getReview(uniqueid: string): Promise<AiCallReview | null> {
    const [r] = await this.reviews.find({ where: { uniqueid }, take: 1 });
    return r ?? null;
  }

  /* --------------------------- recordings --------------------------- */

  private recordingExists(uniqueid: string): boolean {
    const p = this.recordingPath(uniqueid);
    return p ? existsSync(p) : false;
  }

  /** Resolve + confine an AI recording path; null if invalid/out of bounds. */
  private recordingPath(uniqueid: string): string | null {
    if (!/^[0-9]+\.[0-9]+$/.test(uniqueid) && !/^[0-9]+$/.test(uniqueid)) {
      return null;
    }
    const file = path.resolve(AVR_RECORDINGS_DIR, `ai-${uniqueid}.wav`);
    if (file !== path.join(AVR_RECORDINGS_DIR, `ai-${uniqueid}.wav`)) return null;
    return file;
  }

  /** Open a read stream for an AI recording (for the controller to return). */
  streamRecording(uniqueid: string): { stream: ReturnType<typeof createReadStream>; filename: string } {
    const p = this.recordingPath(uniqueid);
    if (!p || !existsSync(p)) {
      throw new NotFoundException('Recording not found');
    }
    return { stream: createReadStream(p), filename: `ai-${uniqueid}.wav` };
  }

  /* --------------------------- compilation -------------------------- */

  private oneLine(v?: string | null): string {
    return (v ?? '').replace(/\s+/g, ' ').trim();
  }

  private endStop(s: string): string {
    return /[.!?]$/.test(s) ? s : `${s}.`;
  }

  private strip(s: string): string {
    return this.oneLine(s).replace(/[.!?,\s]+$/, '');
  }

  compile(cfg: AiAgentConfig): string {
    const name = this.strip(cfg.agentName) || 'the assistant';
    const org = this.strip(cfg.organizationName);
    const parts: string[] = [];

    parts.push(
      org
        ? `You are ${name}, a phone support agent for ${org}.`
        : `You are ${name}, a phone support agent.`,
    );

    const desc = this.oneLine(cfg.businessDescription);
    if (desc) parts.push(org ? `About ${org}: ${desc}` : desc);

    if (cfg.language === 'bn') {
      parts.push(
        cfg.allowEnglish
          ? 'Greet and speak in Bangla by default; switch to English only if the caller speaks English.'
          : 'Greet and speak in Bangla at all times.',
      );
    } else if (cfg.language === 'en') {
      parts.push('Greet and speak in English.');
    }

    const persona = this.oneLine(cfg.personality);
    if (persona) parts.push(persona);

    parts.push(
      'Keep every reply to one or two short sentences suitable for speaking aloud.',
    );

    const facts = this.oneLine(cfg.businessFacts);
    if (facts) parts.push(`Business information you can use: ${facts}`);

    const greeting = this.oneLine(cfg.greeting);
    if (greeting) parts.push(`Begin the call by saying: "${greeting}"`);

    const fallback = this.oneLine(cfg.fallbackBehavior);
    parts.push(
      fallback ||
        'If you cannot help or the caller asks for a person, tell them you will connect them to a human agent, then stop.',
    );

    return parts.map((p) => this.endStop(p)).join(' ');
  }

  /* ----------------------------- AVR I/O ---------------------------- */

  private envPath(): string {
    return path.join(AVR_DIR, '.env');
  }

  private async hasApiKey(): Promise<boolean> {
    try {
      const raw = await fsp.readFile(this.envPath(), 'utf8');
      const m = raw.match(/^GEMINI_API_KEY=(.*)$/m);
      return !!m && m[1].trim().length > 0;
    } catch {
      return false;
    }
  }

  private async writeAvrEnv(
    instructions: string,
    model: string,
    voice: string,
    apiKey?: string,
  ): Promise<void> {
    const file = this.envPath();
    let raw: string;
    try {
      raw = await fsp.readFile(file, 'utf8');
    } catch (err) {
      throw new ServiceUnavailableException(
        `Cannot read AVR .env at ${file}: ${(err as Error).message}`,
      );
    }

    const lines = raw.split('\n');
    const set = (key: string, value: string): void => {
      const line = `${key}=${value}`;
      const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
      if (idx >= 0) lines[idx] = line;
      else lines.push(line);
    };
    const quote = (v: string): string =>
      `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    set('GEMINI_INSTRUCTIONS', quote(instructions));
    set('GEMINI_MODEL', model);
    set('GEMINI_VOICE', voice || '');
    if (apiKey) set('GEMINI_API_KEY', apiKey);

    const tmp = `${file}.tmp`;
    try {
      await fsp.writeFile(tmp, lines.join('\n'), { mode: 0o600 });
      await fsp.rename(tmp, file);
    } catch (err) {
      throw new ServiceUnavailableException(
        `Cannot write AVR .env: ${(err as Error).message}`,
      );
    }
  }

  private async recreateContainer(): Promise<void> {
    try {
      await this.sgDocker(
        `cd "${AVR_DIR}" && docker compose up -d --force-recreate ${STS_SERVICE}`,
        120_000,
      );
    } catch (err) {
      this.logger.error(
        `AVR container recreate failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Saved the configuration, but restarting the AI container failed. ' +
          'Check the AVR docker stack and try Publish again.',
      );
    }
  }

  private async containerRunning(): Promise<boolean> {
    try {
      const { stdout } = await this.sgDocker(
        `docker inspect -f '{{.State.Running}}' ${STS_SERVICE}`,
        8_000,
      );
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }
}
