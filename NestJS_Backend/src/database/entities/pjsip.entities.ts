import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * PJSIP realtime tables read directly by Asterisk via res_config_pgsql.
 * Column names/types MUST match Asterisk sorcery expectations — do not rename.
 * The backend writes these rows; Asterisk reads them live (no restart needed).
 * See asterisk_configuration.md for the matching sorcery.conf / extconfig.conf.
 */

@Entity('ps_aors')
export class PsAor {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact: string | null;

  @Column({ name: 'max_contacts', type: 'int', nullable: true, default: 1 })
  max_contacts: number | null;

  @Column({ name: 'remove_existing', type: 'varchar', length: 5, nullable: true, default: 'yes' })
  remove_existing: string | null;

  @Column({ name: 'qualify_frequency', type: 'int', nullable: true, default: 60 })
  qualify_frequency: number | null;

  @Column({ name: 'authenticate_qualify', type: 'varchar', length: 5, nullable: true })
  authenticate_qualify: string | null;

  @Column({ name: 'maximum_expiration', type: 'int', nullable: true })
  maximum_expiration: number | null;

  @Column({ name: 'minimum_expiration', type: 'int', nullable: true })
  minimum_expiration: number | null;

  @Column({ name: 'default_expiration', type: 'int', nullable: true })
  default_expiration: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  mailboxes: string | null;

  @Column({ name: 'support_path', type: 'varchar', length: 5, nullable: true })
  support_path: string | null;
}

@Entity('ps_auths')
export class PsAuth {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ name: 'auth_type', type: 'varchar', length: 20, nullable: true, default: 'userpass' })
  auth_type: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  realm: string | null;

  @Column({ name: 'md5_cred', type: 'varchar', length: 40, nullable: true })
  md5_cred: string | null;

  @Column({ name: 'nonce_lifetime', type: 'int', nullable: true })
  nonce_lifetime: number | null;
}

@Entity('ps_endpoints')
export class PsEndpoint {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 40, nullable: true, default: 'transport-wss' })
  transport: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  aors: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  auth: string | null;

  @Column({ name: 'outbound_auth', type: 'varchar', length: 40, nullable: true })
  outbound_auth: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true, default: 'from-internal' })
  context: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, default: '!all,ulaw,alaw,opus' })
  disallow: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, default: 'ulaw,alaw,opus' })
  allow: string | null;

  @Column({ name: 'direct_media', type: 'varchar', length: 5, nullable: true, default: 'no' })
  direct_media: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  callerid: string | null;

  @Column({ name: 'dtmf_mode', type: 'varchar', length: 10, nullable: true, default: 'rfc4733' })
  dtmf_mode: string | null;

  @Column({ name: 'force_rport', type: 'varchar', length: 5, nullable: true, default: 'yes' })
  force_rport: string | null;

  @Column({ name: 'rewrite_contact', type: 'varchar', length: 5, nullable: true, default: 'yes' })
  rewrite_contact: string | null;

  @Column({ name: 'rtp_symmetric', type: 'varchar', length: 5, nullable: true, default: 'yes' })
  rtp_symmetric: string | null;

  @Column({ name: 'ice_support', type: 'varchar', length: 5, nullable: true, default: 'no' })
  ice_support: string | null;

  /** webrtc=yes auto-enables dtls, avpf, rtcp_mux, ice — used for browser softphones. */
  @Column({ type: 'varchar', length: 5, nullable: true, default: 'no' })
  webrtc: string | null;

  @Column({ name: 'use_avpf', type: 'varchar', length: 5, nullable: true })
  use_avpf: string | null;

  @Column({ name: 'media_encryption', type: 'varchar', length: 10, nullable: true })
  media_encryption: string | null;

  @Column({ name: 'dtls_auto_generate_cert', type: 'varchar', length: 5, nullable: true })
  dtls_auto_generate_cert: string | null;

  @Column({ name: 'rtcp_mux', type: 'varchar', length: 5, nullable: true })
  rtcp_mux: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  mailboxes: string | null;

  @Column({ name: 'call_group', type: 'varchar', length: 40, nullable: true })
  call_group: string | null;

  @Column({ name: 'pickup_group', type: 'varchar', length: 40, nullable: true })
  pickup_group: string | null;

  @Column({ name: 'named_call_group', type: 'varchar', length: 40, nullable: true })
  named_call_group: string | null;

  @Column({ name: 'device_state_busy_at', type: 'int', nullable: true })
  device_state_busy_at: number | null;

  @Column({ name: 'allow_subscribe', type: 'varchar', length: 5, nullable: true })
  allow_subscribe: string | null;
}

/** IP-authenticated endpoints (static trunks) map source IPs to an endpoint. */
@Entity('ps_endpoint_id_ips')
export class PsEndpointIdIp {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 40 })
  endpoint: string;

  @Column({ type: 'varchar', length: 80 })
  match: string;

  @Column({ name: 'srv_lookups', type: 'varchar', length: 5, nullable: true, default: 'yes' })
  srv_lookups: string | null;

  @Column({ name: 'match_header', type: 'varchar', length: 255, nullable: true })
  match_header: string | null;
}

/** Outbound SIP registrations for registration-based trunks. */
@Entity('ps_registrations')
export class PsRegistration {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  id: string;

  @Column({ type: 'varchar', length: 40, nullable: true, default: 'transport-udp' })
  transport: string | null;

  @Column({ name: 'outbound_auth', type: 'varchar', length: 40, nullable: true })
  outbound_auth: string | null;

  @Column({ name: 'server_uri', type: 'varchar', length: 255 })
  server_uri: string;

  @Column({ name: 'client_uri', type: 'varchar', length: 255 })
  client_uri: string;

  @Column({ name: 'contact_user', type: 'varchar', length: 40, nullable: true })
  contact_user: string | null;

  @Column({ name: 'retry_interval', type: 'int', nullable: true, default: 60 })
  retry_interval: number | null;

  @Column({ name: 'forbidden_retry_interval', type: 'int', nullable: true, default: 600 })
  forbidden_retry_interval: number | null;

  @Column({ type: 'int', nullable: true, default: 3600 })
  expiration: number | null;

  @Column({ name: 'max_retries', type: 'int', nullable: true, default: 10 })
  max_retries: number | null;

  @Column({ name: 'auth_rejection_permanent', type: 'varchar', length: 5, nullable: true, default: 'no' })
  auth_rejection_permanent: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  line: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  endpoint: string | null;
}
