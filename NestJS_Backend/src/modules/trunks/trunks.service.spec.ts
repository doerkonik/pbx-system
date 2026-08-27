import { DataSource, EntityManager } from 'typeorm';
import { TrunksService } from './trunks.service';
import { CreateTrunkDto } from './dto/trunk.dto';
import { RedisService } from '../../redis/redis.service';
import { TrunkAuthType } from '../../common/enums';
import {
  PsAor,
  PsAuth,
  PsEndpoint,
  PsEndpointIdIp,
  PsRegistration,
  Trunk,
} from '../../database/entities';

/** A minimal per-entity repository mock that records save() payloads. */
interface RepoMock {
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  findOneByOrFail: jest.Mock;
}

function makeRepo(): RepoMock {
  return {
    save: jest.fn((v) => Promise.resolve({ id: 'trunk-uuid', ...v })),
    create: jest.fn((v) => v),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    findOneByOrFail: jest.fn((v) => Promise.resolve({ id: 'trunk-uuid', ...v })),
  };
}

describe('TrunksService', () => {
  let service: TrunksService;
  let repos: Map<unknown, RepoMock>;
  let trunkRepo: { findOne: jest.Mock };
  let redis: RedisService;

  beforeEach(() => {
    repos = new Map<unknown, RepoMock>([
      [Trunk, makeRepo()],
      [PsAor, makeRepo()],
      [PsAuth, makeRepo()],
      [PsEndpoint, makeRepo()],
      [PsEndpointIdIp, makeRepo()],
      [PsRegistration, makeRepo()],
    ]);

    const mgr = {
      getRepository: (entity: unknown) => repos.get(entity),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn((cb: (m: EntityManager) => unknown) => cb(mgr)),
    } as unknown as DataSource;

    // No existing trunk → no conflict.
    trunkRepo = { findOne: jest.fn(() => Promise.resolve(null)) };

    redis = {
      client: { hgetall: jest.fn(() => Promise.resolve({})) },
    } as unknown as RedisService;

    // pjsip reload is best-effort; mock it so create/update/remove can call it.
    const telephony = { rawAction: jest.fn(() => Promise.resolve({})) };

    service = new TrunksService(
      trunkRepo as never,
      dataSource,
      redis,
      telephony as never,
    );
  });

  const repo = (entity: unknown): RepoMock => repos.get(entity)!;

  it('writes PsAuth/PsAor/PsEndpoint/PsRegistration for a REGISTRATION trunk', async () => {
    const dto: CreateTrunkDto = {
      name: 'provider-a',
      authType: TrunkAuthType.REGISTRATION,
      sipServer: 'sip.provider.com',
      sipPort: 5060,
      username: 'acct123',
      password: 's3cret-pass',
      codecs: 'ulaw,alaw',
    };

    await service.create(dto);

    // AOR points at the provider host:port.
    expect(repo(PsAor).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-a',
        contact: 'sip:sip.provider.com:5060',
      }),
    );

    // Auth carries the userpass credentials.
    expect(repo(PsAuth).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-a',
        auth_type: 'userpass',
        username: 'acct123',
        password: 's3cret-pass',
      }),
    );

    // Endpoint references the auth (outbound auth) + trunk context + codecs.
    expect(repo(PsEndpoint).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-a',
        aors: 'provider-a',
        auth: 'provider-a',
        context: 'from-trunk',
        transport: 'transport-udp',
        allow: 'ulaw,alaw',
      }),
    );

    // Outbound registration is created with the correct URIs.
    expect(repo(PsRegistration).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-a',
        server_uri: 'sip:sip.provider.com',
        client_uri: 'sip:acct123@sip.provider.com',
        outbound_auth: 'provider-a',
        endpoint: 'provider-a',
      }),
    );

    // REGISTRATION trunks never write an identify row.
    expect(repo(PsEndpointIdIp).save).not.toHaveBeenCalled();
    expect(repo(Trunk).save).toHaveBeenCalledTimes(1);
  });

  it('writes PsEndpoint/PsAor/PsEndpointIdIp (no auth/registration) for an IP trunk', async () => {
    const dto: CreateTrunkDto = {
      name: 'carrier-ip',
      authType: TrunkAuthType.IP,
      sipServer: '203.0.113.5',
      sipPort: 5060,
      matchIp: '203.0.113.0/24',
    };

    await service.create(dto);

    expect(repo(PsAor).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'carrier-ip',
        contact: 'sip:203.0.113.5:5060',
      }),
    );

    // Endpoint has no auth for an IP-auth trunk.
    expect(repo(PsEndpoint).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'carrier-ip',
        aors: 'carrier-ip',
        auth: null,
        context: 'from-trunk',
      }),
    );

    // Identify row maps the source IP/CIDR to the endpoint.
    expect(repo(PsEndpointIdIp).save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'carrier-ip',
        endpoint: 'carrier-ip',
        match: '203.0.113.0/24',
      }),
    );

    // IP trunks never write auth or registration rows.
    expect(repo(PsAuth).save).not.toHaveBeenCalled();
    expect(repo(PsRegistration).save).not.toHaveBeenCalled();
  });

  it('rejects a REGISTRATION trunk missing credentials', async () => {
    const dto = {
      name: 'bad-reg',
      authType: TrunkAuthType.REGISTRATION,
      sipServer: 'sip.provider.com',
    } as CreateTrunkDto;

    await expect(service.create(dto)).rejects.toThrow(
      /username is required/i,
    );
  });
});
