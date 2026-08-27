import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AiAgentService } from './ai-agent.service';
import {
  IngestTranscriptDto,
  ListenDto,
  PublishAiAgentDto,
  RestartAvrDto,
  UpdateAiAgentConfigDto,
  UpdateAiTelephonyDto,
} from './dto/ai-agent.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

/**
 * AI Studio — manage the AVR/Gemini voice agent (identity, model, voice, dial
 * plan), monitor its containers, and analyse AI-handled calls. Viewing is open
 * to supervisors; changes that touch the live system are admin-only.
 */
@Controller('ai-agent')
export class AiAgentController {
  constructor(private readonly service: AiAgentService) {}

  /* -------- studio (persona/model/voice) -------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('config')
  getConfig() {
    return this.service.getView();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('status')
  getStatus() {
    return this.service.status();
  }

  @Roles(UserRole.ADMIN)
  @Put('config')
  updateConfig(@Body() dto: UpdateAiAgentConfigDto) {
    return this.service.update(dto);
  }

  @Roles(UserRole.ADMIN)
  @Post('publish')
  @HttpCode(200)
  publish(@Body() dto: PublishAiAgentDto) {
    return this.service.publish(dto);
  }

  /* -------- telephony (dial plan) -------- */

  @Roles(UserRole.ADMIN)
  @Put('telephony')
  updateTelephony(@Body() dto: UpdateAiTelephonyDto) {
    return this.service.updateTelephony(dto);
  }

  /* -------- containers (health / logs / restart) -------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('health')
  health() {
    return this.service.health();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('logs')
  logs(@Query('service') service: string, @Query('lines') lines?: string) {
    return this.service.logs(service, Number(lines) || 100);
  }

  @Roles(UserRole.ADMIN)
  @Post('restart')
  @HttpCode(200)
  restart(@Body() dto: RestartAvrDto) {
    return this.service.restart(dto.service);
  }

  /* -------- live supervision -------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('live')
  live() {
    return this.service.listLive();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('listen')
  @HttpCode(200)
  listen(@Body() dto: ListenDto, @CurrentUser('extension') ext: string | null) {
    return this.service.listen(dto.channel, dto.mode, ext);
  }

  /* -------- analytics + recordings -------- */

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('analytics')
  analytics(@Query('days') days?: string) {
    return this.service.analytics(Number(days) || 14);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('recording/:uniqueid')
  @Header('Content-Type', 'audio/wav')
  recording(@Param('uniqueid') uniqueid: string): StreamableFile {
    const { stream, filename } = this.service.streamRecording(uniqueid);
    return new StreamableFile(stream, {
      type: 'audio/wav',
      disposition: `inline; filename="${filename}"`,
    });
  }

  /* -------- transcripts + CSAT -------- */

  /**
   * Transcript segment ingest from the AVR container. Public (no JWT) but
   * guarded by a shared secret header; rate-limiting is skipped since segments
   * arrive frequently during a call.
   */
  @Public()
  @SkipThrottle()
  @Post('transcript')
  @HttpCode(204)
  transcript(
    @Headers('x-ingest-secret') secret: string,
    @Body() dto: IngestTranscriptDto,
  ): void {
    this.service.ingestTranscript(secret, dto.audiosocketId, dto.role, dto.text);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Get('review/:uniqueid')
  review(@Param('uniqueid') uniqueid: string) {
    return this.service.getReview(uniqueid);
  }
}
