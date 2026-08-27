import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import configuration, {
  AppConfig,
  DbConfig,
  ThrottleConfig,
} from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { ALL_ENTITIES } from './database/entities';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { RedisModule } from './redis/redis.module';
import { TelephonyModule } from './telephony/telephony.module';
import { RealtimeModule } from './realtime/realtime.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ExtensionsModule } from './modules/extensions/extensions.module';
import { TrunksModule } from './modules/trunks/trunks.module';
import { OutboundRoutesModule } from './modules/outbound-routes/outbound-routes.module';
import { DidsModule } from './modules/dids/dids.module';
import { InboundRoutesModule } from './modules/inbound-routes/inbound-routes.module';
import { TimeRoutingModule } from './modules/time-routing/time-routing.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { IvrModule } from './modules/ivr/ivr.module';
import { QueuesModule } from './modules/queues/queues.module';
import { RingGroupsModule } from './modules/ring-groups/ring-groups.module';
import { CallbacksModule } from './modules/callbacks/callbacks.module';
import { SkillsModule } from './modules/skills/skills.module';
import { MiscDestinationsModule } from './modules/misc-destinations/misc-destinations.module';
import { MohModule } from './modules/moh/moh.module';
import { VoicemailModule } from './modules/voicemail/voicemail.module';
import { ConferenceModule } from './modules/conference/conference.module';
import { CdrModule } from './modules/cdr/cdr.module';
import { CallForwardingModule } from './modules/call-forwarding/call-forwarding.module';
import { CallControlModule } from './modules/call-control/call-control.module';
import { BreaksModule } from './modules/breaks/breaks.module';
import { AgentSessionsModule } from './modules/agent-sessions/agent-sessions.module';
import { DispositionsModule } from './modules/dispositions/dispositions.module';
import { AgentStateModule } from './modules/agent-state/agent-state.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { SoftphoneModule } from './modules/softphone/softphone.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { SystemModule } from './modules/system/system.module';
import { CommsModule } from './modules/comms/comms.module';
import { AdminModule } from './modules/admin/admin.module';
import { QaModule } from './modules/qa/qa.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SecurityModule } from './modules/security/security.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const app = config.get<AppConfig>('app')!;
        return {
          pinoHttp: {
            level: app.logLevel,
            transport:
              app.env !== 'production'
                ? { target: 'pino-pretty', options: { singleLine: true } }
                : undefined,
            redact: ['req.headers.authorization', 'req.body.password'],
          },
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<DbConfig>('db')!;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.name,
          entities: ALL_ENTITIES,
          synchronize: db.synchronize,
          logging: db.logging,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.get<ThrottleConfig>('throttle')!;
        return {
          throttlers: [
            { name: 'default', ttl: t.ttlMs, limit: t.limit },
            { name: 'auth', ttl: t.ttlMs, limit: t.authLimit },
          ],
        };
      },
    }),

    ScheduleModule.forRoot(),

    // Infrastructure
    RedisModule,
    TelephonyModule,
    RealtimeModule,
    SecurityModule,
    AuditModule,

    // Features
    AuthModule,
    UsersModule,
    ExtensionsModule,
    TrunksModule,
    OutboundRoutesModule,
    DidsModule,
    InboundRoutesModule,
    TimeRoutingModule,
    BlacklistModule,
    RecordingsModule,
    IvrModule,
    QueuesModule,
    RingGroupsModule,
    CallbacksModule,
    SkillsModule,
    MiscDestinationsModule,
    MohModule,
    VoicemailModule,
    ConferenceModule,
    CdrModule,
    CallForwardingModule,
    CallControlModule,
    BreaksModule,
    AgentSessionsModule,
    DispositionsModule,
    AgentStateModule,
    CampaignsModule,
    DashboardModule,
    MonitoringModule,
    SoftphoneModule,
    ReportsModule,
    AnalyticsModule,
    HealthModule,
    SystemModule,
    CommsModule,
    AdminModule,
    QaModule,
    MonitorModule,
    SchedulerModule,
    AiAgentModule,
  ],
  providers: [
    // Order matters: authenticate, then throttle, then authorize by role.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Records every mutating request to the audit trail (Module 10).
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
