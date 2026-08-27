import { SystemService } from './system.service';

describe('SystemService.serverStatus', () => {
  // serverStatus only uses os/fs, so the Redis/Telephony deps are unused here.
  const service = new SystemService(null as any, null as any);

  it('reports sane host resource stats', async () => {
    const s = await service.serverStatus('/');

    expect(typeof s.hostname).toBe('string');
    expect(s.cpu.cores).toBeGreaterThan(0);
    expect(s.cpu.loadAvg).toHaveLength(3);
    expect(s.cpu.usagePct).toBeGreaterThanOrEqual(0);
    expect(s.cpu.usagePct).toBeLessThanOrEqual(100);

    expect(s.memory.totalBytes).toBeGreaterThan(0);
    expect(s.memory.usedBytes).toBeLessThanOrEqual(s.memory.totalBytes);
    expect(s.memory.usedPct).toBeGreaterThanOrEqual(0);
    expect(s.memory.usedPct).toBeLessThanOrEqual(100);

    // disk may be null if fs.statfs is unavailable; when present it's sane.
    if (s.disk) {
      expect(s.disk.usedPct).toBeGreaterThanOrEqual(0);
      expect(s.disk.usedPct).toBeLessThanOrEqual(100);
    }
  });

  it('rejects an unsafe ping host without spawning', async () => {
    const res = await service.ping('bad;rm -rf');
    expect(res.reachable).toBe(false);
    expect(res.output).toBe('Invalid host');
  });
});
