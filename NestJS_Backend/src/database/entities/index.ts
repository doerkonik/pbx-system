import {
  PsAor,
  PsAuth,
  PsEndpoint,
  PsEndpointIdIp,
  PsRegistration,
} from './pjsip.entities';
import { AstQueue, AstQueueMember, Cdr, QueueLog } from './asterisk.entities';
import {
  BlacklistEntry,
  CallForwarding,
  Conference,
  Extension,
  IvrEntry,
  IvrMenu,
  MiscDestination,
  MohClass,
  MohFile,
  OutboundRoute,
  QueueConfig,
  Recording,
  Trunk,
  User,
} from './operational.entities';
import {
  AgentSession,
  AgentStatusLog,
  DailyAgentStats,
  DailyQueueStats,
} from './reporting.entities';
import { BreakReasonConfig } from './break-reason.entity';
import {
  Did,
  Holiday,
  InboundRoute,
  TimeCondition,
  TimeGroup,
  TimeGroupRange,
} from './routing.entities';
import { CallDisposition, DispositionCode } from './disposition.entities';
import { AgentPreference } from './agent-preferences.entity';
import { Campaign, CampaignContact } from './campaign.entities';
import { MonitoringAlert, SlaThreshold } from './monitoring.entities';
import { AuditLog } from './audit-log.entity';
import { VoicemailBox } from './voicemail.entity';
import { QueueCallback, RingGroup } from './call-flow.entities';
import {
  AgentSkill,
  QueueSkillRequirement,
  Skill,
} from './skill.entities';
import { DirectMessage, Notification } from './comms.entities';
import { BackupRecord } from './backup.entity';
import {
  CallNote,
  QaEvaluation,
  QaForm,
  QaQuestion,
  QaScore,
} from './qa.entities';
import { AiAgentConfig } from './ai-agent.entity';
import { AiCallReview } from './ai-call-review.entity';

export * from './pjsip.entities';
export * from './asterisk.entities';
export * from './operational.entities';
export * from './reporting.entities';
export * from './break-reason.entity';
export * from './routing.entities';
export * from './disposition.entities';
export * from './agent-preferences.entity';
export * from './campaign.entities';
export * from './monitoring.entities';
export * from './audit-log.entity';
export * from './voicemail.entity';
export * from './call-flow.entities';
export * from './skill.entities';
export * from './comms.entities';
export * from './backup.entity';
export * from './qa.entities';
export * from './ai-agent.entity';
export * from './ai-call-review.entity';

/** Single source of truth for TypeORM entity registration and migrations. */
export const ALL_ENTITIES = [
  // PJSIP realtime
  PsAor,
  PsAuth,
  PsEndpoint,
  PsEndpointIdIp,
  PsRegistration,
  // Asterisk data
  AstQueue,
  AstQueueMember,
  Cdr,
  QueueLog,
  // Operational
  User,
  Extension,
  Trunk,
  OutboundRoute,
  BlacklistEntry,
  Recording,
  CallForwarding,
  MiscDestination,
  MohClass,
  MohFile,
  IvrMenu,
  IvrEntry,
  QueueConfig,
  Conference,
  // Reporting
  AgentStatusLog,
  AgentSession,
  DailyAgentStats,
  DailyQueueStats,
  // Configuration
  BreakReasonConfig,
  // Inbound routing
  Did,
  InboundRoute,
  TimeGroup,
  TimeGroupRange,
  TimeCondition,
  Holiday,
  // Agent dispositions
  DispositionCode,
  CallDisposition,
  // Agent preferences
  AgentPreference,
  // Outbound dialer
  Campaign,
  CampaignContact,
  // Supervisor monitoring
  SlaThreshold,
  MonitoringAlert,
  // Security / audit
  AuditLog,
  // Voicemail (Asterisk realtime)
  VoicemailBox,
  // Call flow
  RingGroup,
  QueueCallback,
  // Skill-based routing
  Skill,
  AgentSkill,
  QueueSkillRequirement,
  // Notifications & messaging
  Notification,
  DirectMessage,
  // Backup & system admin
  BackupRecord,
  // Quality assurance
  QaForm,
  QaQuestion,
  QaEvaluation,
  QaScore,
  CallNote,
  // AI voice agent
  AiAgentConfig,
  AiCallReview,
];
