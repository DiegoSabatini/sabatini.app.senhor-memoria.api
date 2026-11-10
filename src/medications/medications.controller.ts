import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateMedicationDto, UpdateMedicationDto } from './dto/medication.dto';
import { MedicationsService } from './medications.service';

@ApiTags('medications')
@ApiBearerAuth()
@Controller()
export class MedicationsController {
  constructor(private readonly medications: MedicationsService) {}

  @Get('profiles/:profileId/medications')
  list(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean,
  ) {
    return this.medications.list(user.id, profileId, includeInactive);
  }

  @Post('profiles/:profileId/medications')
  create(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    return this.medications.create(user.id, profileId, dto);
  }

  @Get('medications/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.medications.get(user.id, id);
  }

  @Patch('medications/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medications.update(user.id, id, dto);
  }

  @Delete('medications/:id')
  @HttpCode(204)
  deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.medications.deactivate(user.id, id);
  }
}
