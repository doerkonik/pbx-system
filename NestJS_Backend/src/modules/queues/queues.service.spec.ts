import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueuesService } from './queues.service';
import {
  AstQueue,
  AstQueueMember,
  QueueConfig,
} from '../../database/entities';
import { RedisService } from '../../redis/redis.service';
import { TelephonyService } from '../../telephony/telephony.service';
import { QueueStrategy } from '../../common/enums';

/**
 * Builds a mock transaction manager whose getRepository(Entity) returns a stub
 * with save/create/update/findOneByOrFail so the service's DataSource.transaction
 * callback runs against in-memory doubles.
 */
function buildManager() {
  const astQueueRepo = {
    save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const queueConfigRepo = {
    create: jest.fn().mockImplementation((row) => row),
    save: jest
      .fn()
      .mockImplementation((row) => Promise.resolve({ id: 'uuid-1', ...row })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneByOrFail: jest.fn(),
  };
  const memberRepo = {
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === AstQueue) return astQueueRepo;
      if (entity === QueueConfig) return queueConfigRepo;
      if (entity === AstQueueMember) return memberRepo;
      throw new Error('unexpected entity');
    }),
  };

  return { manager, astQueueRepo, queueConfigRepo, memberRepo };
}

describe('QueuesService', () => {
  let service: QueuesService;
  let configRepo: { findOne: jest.Mock };
  let memberRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let redis: { client: { sadd: jest.Mock; srem: jest.Mock; hgetall: jest.Mock } };
  let telephony: {
    addQueueMember: jest.Mock;
    removeQueueMember: jest.Mock;
  };
  let managerBundle: ReturnType<typeof buildManager>;

  beforeEach(async () => {
    configRepo = { findOne: jest.fn() };
    memberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((row) => row),
      save: jest
        .fn()
        .mockImplementation((row) => Promise.resolve({ uniqueid: 1, ...row })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    managerBundle = buildManager();
    dataSource = {
      transaction: jest.fn((cb: any) => cb(managerBundle.manager)),
    };
    redis = {
      client: {
        sadd: jest.fn().mockResolvedValue(1),
        srem: jest.fn().mockResolvedValue(1),
        hgetall: jest.fn().mockResolvedValue({}),
      },
    };
    telephony = {
      addQueueMember: jest.fn().mockResolvedValue(undefined),
      removeQueueMember: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueuesService,
        { provide: getRepositoryToken(QueueConfig), useValue: configRepo },
        { provide: getRepositoryToken(AstQueueMember), useValue: memberRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: RedisService, useValue: redis },
        { provide: TelephonyService, useValue: telephony },
      ],
    }).compile();

    service = module.get(QueuesService);
  });

  describe('create', () => {
    it('writes BOTH the realtime AstQueue row and the QueueConfig metadata row', async () => {
      configRepo.findOne.mockResolvedValue(null);

      const result = await service.create({
        name: 'sales',
        displayName: 'Sales Team',
        strategy: QueueStrategy.RINGALL,
        mohClass: 'holdmusic',
        timeout: 20,
        wrapupTime: 5,
        maxlen: 10,
        ringinuse: false,
        maxWait: 120,
        recordingEnabled: true,
      });

      // Realtime row (Asterisk contract).
      expect(managerBundle.astQueueRepo.save).toHaveBeenCalledTimes(1);
      expect(managerBundle.astQueueRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'sales',
          strategy: QueueStrategy.RINGALL,
          timeout: 20,
          wrapuptime: 5,
          musiconhold: 'holdmusic',
          maxlen: 10,
          ringinuse: 'no',
        }),
      );

      // App-metadata row.
      expect(managerBundle.queueConfigRepo.save).toHaveBeenCalledTimes(1);
      expect(managerBundle.queueConfigRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'sales',
          displayName: 'Sales Team',
          strategy: QueueStrategy.RINGALL,
          mohClass: 'holdmusic',
          timeout: 20,
          wrapupTime: 5,
          maxWait: 120,
          recordingEnabled: true,
          isActive: true,
        }),
      );

      expect(redis.client.sadd).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ name: 'sales' }));
    });

    it('rejects a duplicate queue name', async () => {
      configRepo.findOne.mockResolvedValue({ name: 'sales' });
      await expect(service.create({ name: 'sales' } as any)).rejects.toThrow(
        /already exists/,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('addMember', () => {
    it('persists a queue_members row AND calls TelephonyService.addQueueMember', async () => {
      configRepo.findOne.mockResolvedValue({ name: 'sales' });
      memberRepo.findOne.mockResolvedValue(null);

      const result = await service.addMember('sales', {
        extension: '1001',
        penalty: 2,
        paused: false,
      });

      // Row persisted with the derived PJSIP interface.
      expect(memberRepo.save).toHaveBeenCalledTimes(1);
      expect(memberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          queue_name: 'sales',
          interface: 'PJSIP/1001',
          membername: '1001',
          penalty: 2,
          paused: 0,
        }),
      );

      // Pushed live via telephony.
      expect(telephony.addQueueMember).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: 'sales',
          interfaceName: 'PJSIP/1001',
          memberName: '1001',
          penalty: 2,
          paused: false,
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({ interface: 'PJSIP/1001' }),
      );
    });

    it('throws when the queue does not exist', async () => {
      configRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addMember('ghost', { extension: '1001' }),
      ).rejects.toThrow(/not found/);
      expect(telephony.addQueueMember).not.toHaveBeenCalled();
    });

    it('rejects a duplicate member', async () => {
      configRepo.findOne.mockResolvedValue({ name: 'sales' });
      memberRepo.findOne.mockResolvedValue({ uniqueid: 9 });
      await expect(
        service.addMember('sales', { extension: '1001' }),
      ).rejects.toThrow(/already a member/);
      expect(telephony.addQueueMember).not.toHaveBeenCalled();
    });
  });
});
