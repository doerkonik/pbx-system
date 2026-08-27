import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * app_queues realtime table — Asterisk reads queue definitions live from here.
 * Column names must match Asterisk's queue realtime mapping.
 */
@Entity('queues')
export class AstQueue {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'varchar', length: 128, nullable: true, default: 'default' })
  musiconhold: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  strategy: string | null;

  @Column({ type: 'int', nullable: true, default: 15 })
  timeout: number | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  wrapuptime: number | null;

  @Column({ type: 'int', nullable: true })
  maxlen: number | null;

  @Column({ type: 'varchar', length: 5, nullable: true, default: 'yes' })
  ringinuse: string | null;

  @Column({ type: 'int', nullable: true })
  retry: number | null;

  @Column({ type: 'int', nullable: true, default: 5 })
  announce_frequency: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  joinempty: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  leavewhenempty: string | null;

  @Column({ type: 'int', nullable: true, default: 5 })
  memberdelay: number | null;

  @Column({ type: 'int', nullable: true, default: 1 })
  weight: number | null;
}

/** Static queue members maintained via realtime; dynamic members added via AMI. */
@Entity('queue_members')
export class AstQueueMember {
  @PrimaryGeneratedColumn()
  uniqueid: number;

  @Index()
  @Column({ name: 'queue_name', type: 'varchar', length: 128 })
  queue_name: string;

  @Column({ type: 'varchar', length: 255 })
  interface: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  membername: string | null;

  @Column({ name: 'state_interface', type: 'varchar', length: 255, nullable: true })
  state_interface: string | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  penalty: number | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  paused: number | null;

  @Column({ type: 'int', nullable: true, default: 1 })
  wrapuptime: number | null;
}

/**
 * CDR table written by Asterisk cdr_pgsql. Columns follow the standard
 * cdr_pgsql schema. The backend reads it; Asterisk owns writes.
 */
@Entity('cdr')
export class Cdr {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamptz', nullable: true })
  @Index()
  calldate: Date | null;

  @Column({ type: 'varchar', length: 80, default: '' })
  clid: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  @Index()
  src: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  @Index()
  dst: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  dcontext: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  channel: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  dstchannel: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  lastapp: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  lastdata: string;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({ type: 'int', default: 0 })
  billsec: number;

  @Column({ type: 'varchar', length: 45, default: '' })
  @Index()
  disposition: string;

  @Column({ type: 'int', default: 0 })
  amaflags: number;

  @Column({ type: 'varchar', length: 80, default: '' })
  accountcode: string;

  @Column({ type: 'varchar', length: 150, default: '' })
  @Index()
  uniqueid: string;

  @Column({ type: 'varchar', length: 150, default: '' })
  linkedid: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  userfield: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  peeraccount: string;

  @Column({ type: 'int', default: 0 })
  sequence: number;
}

/**
 * queue_log table. Asterisk can write this via realtime (queue_log_realtime) or
 * we parse /var/log/asterisk/queue_log. Either path lands rows here.
 */
@Entity('queue_log')
export class QueueLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamptz' })
  @Index()
  time: Date;

  @Column({ name: 'callid', type: 'varchar', length: 80, default: '' })
  @Index()
  callid: string;

  @Column({ name: 'queuename', type: 'varchar', length: 128, default: '' })
  @Index()
  queuename: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  agent: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  @Index()
  event: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  data1: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  data2: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  data3: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  data4: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  data5: string;
}
