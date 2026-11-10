import { Global, Module } from '@nestjs/common';
import { ProfileAccessService } from './profile-access.service';
import { ProfilesController, PublicEmergencyController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Global()
@Module({
  controllers: [ProfilesController, PublicEmergencyController],
  providers: [ProfilesService, ProfileAccessService],
  exports: [ProfileAccessService],
})
export class ProfilesModule {}
