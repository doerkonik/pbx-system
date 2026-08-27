import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RollupService } from './rollup.service';
import {
  AgentSession,
  AgentStatusLog,
  Cdr,
  DailyAgentStats,
  DailyQueueStats,
  QueueLog,
  User,
} from '../database/entities';

/** Build a partial QueueLog row with sensible empty defaults. */
function qlog(partial: Partial<QueueLog>): QueueLog {
  return {
    id: 0,
    time: new Date('2026-07-06T10:00:00.000Z'),
    callid: '',
    queuename: '',
    agent: '',
    event: '',
    data1: '',
    data2: '',
    data3: '',
    data4: '',
    data5: '',
    ...partial,
  } as QueueLog;
}

describe('RollupService.rollupForDate (queue metrics)', () => {
  let service: RollupService;
  let queueRows: QueueLog[];
  const queueUpserts: any[] = [];

  const queueLogRepo = {
    find: jest.fn(() => Promise.resolve(queueRows)),
  };
  const queueStatsRepo = {
    upsert: jest.fn((value: any) => {
      queueUpserts.push(value);
      return Promise.resolve({});
    }),
  };
  // No agents → rollupAgents becomes a no-op and never touches the CDR repos.
  const userRepo = { find: jest.fn(() => Promise.resolve([])) };
  const noopRepo = {
    find: jest.fn(() => Promise.resolve([])),
    upsert: jest.fn(() => Promise.resolve({})),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    queueUpserts.length = 0;
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        RollupService,
        { provide: getRepositoryToken(Cdr), useValue: noopRepo },
        { provide: getRepositoryToken(QueueLog), useValue: queueLogRepo },
        { provide: getRepositoryToken(AgentStatusLog), useValue: noopRepo },
        { provide: getRepositoryToken(AgentSession), useValue: noopRepo },
        { provide: getRepositoryToken(DailyAgentStats), useValue: noopRepo },
        { provide: getRepositoryToken(DailyQueueStats), useValue: queueStatsRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();
    service = moduleRef.get(RollupService);
  });

  it('computes offered/answered/abandoned/serviceLevel from queue_log rows', async () => {
    // Queue "sales": 3 offered, 2 answered (waits 5s & 15s → both within 20s SL),
    // 1 abandoned (waited 45s), 1 completed call (talk 120s).
    queueRows = [
      qlog({ queuename: 'sales', event: 'ENTERQUEUE' }),
      qlog({ queuename: 'sales', event: 'ENTERQUEUE' }),
      qlog({ queuename: 'sales', event: 'ENTERQUEUE' }),
      qlog({ queuename: 'sales', event: 'CONNECT', data1: '5' }),
      qlog({ queuename: 'sales', event: 'CONNECT', data1: '15' }),
      qlog({ queuename: 'sales', event: 'ABANDON', data3: '45' }),
      qlog({ queuename: 'sales', event: 'COMPLETECALLER', data2: '120' }),
      // A different queue with a single slow answer (30s → outside SL).
      qlog({ queuename: 'support', event: 'ENTERQUEUE' }),
      qlog({ queuename: 'support', event: 'CONNECT', data1: '30' }),
      // Noise that must be ignored.
      qlog({ queuename: 'NONE', event: 'ENTERQUEUE' }),
      qlog({ queuename: '', event: 'ENTERQUEUE' }),
    ];

    await service.rollupForDate('2026-07-06');

    expect(queueStatsRepo.upsert).toHaveBeenCalled();
    const sales = queueUpserts.find((u) => u.queueName === 'sales');
    expect(sales).toBeDefined();
    expect(sales.statDate).toBe('2026-07-06');
    expect(sales.offered).toBe(3);
    expect(sales.answered).toBe(2);
    expect(sales.abandoned).toBe(1);
    expect(sales.totalWaitSec).toBe(65); // 5 + 15 + 45
    expect(sales.maxWaitSec).toBe(45);
    expect(sales.totalTalkSec).toBe(120);
    expect(sales.avgTalkSec).toBe(120);
    expect(sales.avgWaitSec).toBe(22); // round(65 / 3)
    // 2 of 3 offered answered within 20s.
    expect(sales.serviceLevelPct).toBe('66.67');

    const support = queueUpserts.find((u) => u.queueName === 'support');
    expect(support).toBeDefined();
    expect(support.offered).toBe(1);
    expect(support.answered).toBe(1);
    expect(support.abandoned).toBe(0);
    // Answered at 30s → outside the 20s threshold.
    expect(support.serviceLevelPct).toBe('0.00');

    // NONE / empty queue names produce no rows.
    expect(
      queueUpserts.find((u) => u.queueName === 'NONE' || u.queueName === ''),
    ).toBeUndefined();
    expect(queueUpserts).toHaveLength(2);
  });

  it('rejects a malformed date', async () => {
    await expect(service.rollupForDate('2026/07/06')).rejects.toThrow();
  });
});
