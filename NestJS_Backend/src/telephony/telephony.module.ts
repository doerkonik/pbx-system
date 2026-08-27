import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmiService } from './ami.service';
import { AriService } from './ari.service';
import { LiveStateService } from './live-state.service';
import { TelephonyService } from './telephony.service';
import { IvrRunnerService } from './ivr-runner.service';
import { QueueSnapshotService } from './queue-snapshot.service';
import { BlacklistEntry, IvrMenu } from '../database/entities';

/**
 * The embedded telephony module — the single owner of the AMI + ARI connections.
 * Global so any feature module can inject TelephonyService without re-importing.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BlacklistEntry, IvrMenu])],
  providers: [
    AmiService,
    AriService,
    LiveStateService,
    TelephonyService,
    IvrRunnerService,
    QueueSnapshotService,
  ],
  exports: [TelephonyService, LiveStateService, AmiService, AriService],
})
export class TelephonyModule {}
