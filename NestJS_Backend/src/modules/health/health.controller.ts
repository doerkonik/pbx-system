import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { RedisService } from '../../redis/redis.service';
import { TelephonyService } from '../../telephony/telephony.service';

/**
 * Aggregated health of every critical dependency: Postgres, Redis, and the
 * Asterisk AMI + ARI links. Returns 200 with a per-component breakdown so
 * orchestrators and the dashboard can show a precise status.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly telephony: TelephonyService,
  ) {}

  @Get()
  async check() {
    const [db, redisOk] = await Promise.all([
      this.checkDb(),
      this.redis.isHealthy(),
    ]);
    const tel = this.telephony.isHealthy();

    const components = {
      database: db,
      redis: redisOk,
      asteriskAmi: tel.ami,
      asteriskAri: tel.ari,
    };
    const healthy = Object.values(components).every(Boolean);

    return {
      status: healthy ? 'ok' : 'degraded',
      components,
      connection: this.telephony.getConnectionState(),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
