import { Module } from '@nestjs/common';
import { DoseSchedulerService } from './dose-scheduler.service';
import { DosesController } from './doses.controller';
import { DosesService } from './doses.service';

@Module({
  controllers: [DosesController],
  providers: [DosesService, DoseSchedulerService],
  exports: [DosesService],
})
export class DosesModule {}
