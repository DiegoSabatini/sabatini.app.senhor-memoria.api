import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { DosesService } from './doses.service';
import { AdherenceQueryDto, ConfirmDoseDto, DayQueryDto, UpcomingQueryDto } from './dto/dose.dto';

@ApiTags('doses')
@ApiBearerAuth()
@Controller()
export class DosesController {
  constructor(private readonly doses: DosesService) {}

  /** Agenda de doses de um dia. */
  @Get('profiles/:profileId/doses')
  day(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query() query: DayQueryDto,
  ) {
    return this.doses.listDay(user.id, profileId, query.date);
  }

  /** Próximas doses pendentes, para o app agendar os alarmes locais. */
  @Get('profiles/:profileId/doses/upcoming')
  upcoming(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query() query: UpcomingQueryDto,
  ) {
    return this.doses.listUpcoming(user.id, profileId, query.hours);
  }

  @Get('profiles/:profileId/adherence')
  adherence(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Query() query: AdherenceQueryDto,
  ) {
    return this.doses.adherence(user.id, profileId, query.days);
  }

  @Post('doses/:id/take')
  @HttpCode(200)
  take(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDoseDto,
  ) {
    return this.doses.confirm(user.id, id, 'TAKEN', dto.note);
  }

  @Post('doses/:id/skip')
  @HttpCode(200)
  skip(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmDoseDto,
  ) {
    return this.doses.confirm(user.id, id, 'SKIPPED', dto.note);
  }
}
