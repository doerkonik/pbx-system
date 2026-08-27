import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { Campaign, CampaignContact } from '../../database/entities';

/** Preview-mode outbound dialer. TelephonyService comes from the global module. */
@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignContact])],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
