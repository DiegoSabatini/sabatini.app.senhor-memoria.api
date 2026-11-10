import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import {
  AddMemberDto,
  CreateProfileDto,
  UpdateEmergencyCardDto,
  UpdateMyMembershipDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProfileDto) {
    return this.profiles.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.profiles.listMine(user.id);
  }

  @Get(':profileId')
  get(@CurrentUser() user: AuthUser, @Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.profiles.get(user.id, profileId);
  }

  @Patch(':profileId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.update(user.id, profileId, dto);
  }

  @Delete(':profileId')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.profiles.remove(user.id, profileId);
  }

  // Cartão de emergência

  @Get(':profileId/emergency-card')
  emergencyCard(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.profiles.getEmergencyCard(user.id, profileId);
  }

  @Put(':profileId/emergency-card')
  updateEmergencyCard(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateEmergencyCardDto,
  ) {
    return this.profiles.updateEmergencyCard(user.id, profileId, dto);
  }

  @Post(':profileId/emergency-card/rotate-link')
  rotateEmergencyLink(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ) {
    return this.profiles.rotateEmergencyToken(user.id, profileId);
  }

  // Cuidadores

  @Get(':profileId/members')
  members(@CurrentUser() user: AuthUser, @Param('profileId', ParseUUIDPipe) profileId: string) {
    return this.profiles.listMembers(user.id, profileId);
  }

  @Post(':profileId/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.profiles.addMember(user.id, profileId, dto);
  }

  @Patch(':profileId/members/me')
  updateMyMembership(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateMyMembershipDto,
  ) {
    return this.profiles.updateMyMembership(user.id, profileId, dto);
  }

  @Delete(':profileId/members/:userId')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
  ) {
    return this.profiles.removeMember(user.id, profileId, memberUserId);
  }
}

/** Cartão de emergência aberto pelo QR code, sem login. */
@ApiTags('emergency')
@Controller('emergency')
export class PublicEmergencyController {
  constructor(private readonly profiles: ProfilesService) {}

  @Public()
  @Get(':token')
  card(@Param('token', ParseUUIDPipe) token: string) {
    return this.profiles.getPublicEmergencyCard(token);
  }
}
