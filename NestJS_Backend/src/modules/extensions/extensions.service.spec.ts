import { ConflictException } from '@nestjs/common';
import { ExtensionsService } from './extensions.service';
import {
  Extension,
  PsAor,
  PsAuth,
  PsEndpoint,
} from '../../database/entities';

/** Minimal in-memory repo mock capturing saved rows. */
function repoMock() {
  return {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((x: any) => x),
    save: jest.fn((x: any) => Promise.resolve({ id: 'uuid-1', ...x })),
    update: jest.fn(),
    delete: jest.fn(),
    findOneByOrFail: jest.fn((x: any) => Promise.resolve({ id: 'uuid-1', ...x })),
  };
}

describe('ExtensionsService', () => {
  let service: ExtensionsService;
  let extRepo: ReturnType<typeof repoMock>;
  let redis: any;
  let dataSource: any;
  let managerRepos: Record<string, ReturnType<typeof repoMock>>;

  beforeEach(() => {
    extRepo = repoMock();
    redis = { client: { hgetall: jest.fn().mockResolvedValue({}) } };

    // A shared per-entity repo captured so assertions can inspect writes.
    managerRepos = {
      PsAor: repoMock(),
      PsAuth: repoMock(),
      PsEndpoint: repoMock(),
      Extension: repoMock(),
    };
    const manager = {
      getRepository: (entity: any) => {
        if (entity === PsAor) return managerRepos.PsAor;
        if (entity === PsAuth) return managerRepos.PsAuth;
        if (entity === PsEndpoint) return managerRepos.PsEndpoint;
        if (entity === Extension) return managerRepos.Extension;
        throw new Error('unexpected entity');
      },
    };
    dataSource = {
      transaction: jest.fn((cb: any) => cb(manager)),
    };

    service = new ExtensionsService(extRepo as any, dataSource, redis);
  });

  it('rejects a duplicate extension', async () => {
    extRepo.findOne.mockResolvedValue({ id: 'x', extensionNumber: '1001' });
    await expect(
      service.create({ extensionNumber: '1001', secret: 'secret12' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates the three PJSIP rows + app row for a non-webrtc extension', async () => {
    extRepo.findOne.mockResolvedValue(null);
    await service.create({
      extensionNumber: '1001',
      secret: 'secret12',
      displayName: 'Alice',
    });

    expect(managerRepos.PsAor.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1001', max_contacts: 1 }),
    );
    expect(managerRepos.PsAuth.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1001', username: '1001', password: 'secret12' }),
    );
    expect(managerRepos.PsEndpoint.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1001',
        transport: 'transport-udp',
        webrtc: 'no',
        aors: '1001',
        auth: '1001',
      }),
    );
    expect(managerRepos.Extension.save).toHaveBeenCalledWith(
      expect.objectContaining({ extensionNumber: '1001', webrtc: false }),
    );
  });

  it('enables webrtc columns when webrtc=true', async () => {
    extRepo.findOne.mockResolvedValue(null);
    await service.create({
      extensionNumber: '1002',
      secret: 'secret12',
      webrtc: true,
    });
    expect(managerRepos.PsEndpoint.save).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: 'transport-wss',
        webrtc: 'yes',
        media_encryption: 'dtls',
        dtls_auto_generate_cert: 'yes',
        rtcp_mux: 'yes',
        ice_support: 'yes',
      }),
    );
    expect(managerRepos.PsAor.save).toHaveBeenCalledWith(
      expect.objectContaining({ max_contacts: 5 }),
    );
  });

  it('rejects an invalid extension id via sanitizer', async () => {
    extRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ extensionNumber: 'bad;id', secret: 'secret12' }),
    ).rejects.toBeTruthy();
  });
});
