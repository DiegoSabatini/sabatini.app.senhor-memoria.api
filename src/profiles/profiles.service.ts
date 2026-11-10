import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProfileRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddMemberDto,
  CreateProfileDto,
  UpdateEmergencyCardDto,
  UpdateMyMembershipDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { ProfileAccessService } from './profile-access.service';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProfileAccessService,
  ) {}

  async create(userId: string, dto: CreateProfileDto) {
    this.validateTimezone(dto.timezone);
    return this.prisma.profile.create({
      data: {
        name: dto.name.trim(),
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        timezone: dto.timezone,
        patientUserId: dto.isSelf ? userId : undefined,
        members: { create: { userId, role: ProfileRole.OWNER } },
      },
    });
  }

  async listMine(userId: string) {
    const memberships = await this.prisma.profileMember.findMany({
      where: { userId },
      include: { profile: true },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.profile, myRole: m.role }));
  }

  async get(userId: string, profileId: string) {
    const member = await this.access.assertMember(userId, profileId);
    const profile = await this.prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
    return { ...profile, myRole: member.role };
  }

  async update(userId: string, profileId: string, dto: UpdateProfileDto) {
    await this.access.assertOwner(userId, profileId);
    this.validateTimezone(dto.timezone);
    return this.prisma.profile.update({
      where: { id: profileId },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });
  }

  async remove(userId: string, profileId: string) {
    await this.access.assertOwner(userId, profileId);
    await this.prisma.profile.delete({ where: { id: profileId } });
  }

  // ---------- Cartão de emergência ----------

  async getEmergencyCard(userId: string, profileId: string) {
    await this.access.assertMember(userId, profileId);
    return this.buildEmergencyCard({ id: profileId });
  }

  async getPublicEmergencyCard(token: string) {
    const profile = await this.prisma.profile.findUnique({ where: { emergencyToken: token } });
    if (!profile || !profile.emergencyPublic) throw new NotFoundException('Cartão não encontrado');
    const card = await this.buildEmergencyCard({ id: profile.id });
    // O link público não expõe identificadores internos.
    const { profileId: _id, emergencyToken: _t, emergencyPublic: _p, ...publicCard } = card;
    return publicCard;
  }

  async updateEmergencyCard(userId: string, profileId: string, dto: UpdateEmergencyCardDto) {
    await this.access.assertOwner(userId, profileId);
    const { contacts, ...fields } = dto;
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profileId },
        data: {
          ...fields,
          allergies: fields.allergies?.map((a) => a.trim()).filter(Boolean),
          conditions: fields.conditions?.map((c) => c.trim()).filter(Boolean),
        },
      });
      if (contacts) {
        await tx.emergencyContact.deleteMany({ where: { profileId } });
        await tx.emergencyContact.createMany({
          data: contacts.map((c) => ({ ...c, profileId })),
        });
      }
    });
    return this.buildEmergencyCard({ id: profileId });
  }

  /** Gera um novo link/QR code, invalidando o anterior (ex.: se o QR foi perdido). */
  async rotateEmergencyToken(userId: string, profileId: string) {
    await this.access.assertOwner(userId, profileId);
    await this.prisma.profile.update({
      where: { id: profileId },
      data: { emergencyToken: randomUUID() },
    });
    return this.buildEmergencyCard({ id: profileId });
  }

  private async buildEmergencyCard(where: { id: string }) {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where,
      include: {
        emergencyContacts: true,
        medications: { where: { active: true }, orderBy: { name: 'asc' } },
      },
    });
    const age = profile.birthDate
      ? Math.floor(-DateTime.fromJSDate(profile.birthDate).diffNow('years').years)
      : null;
    return {
      profileId: profile.id,
      name: profile.name,
      age,
      bloodType: profile.bloodType,
      allergies: profile.allergies,
      conditions: profile.conditions,
      // Remédios em uso entram automaticamente no cartão.
      medications: profile.medications.map((m) => ({ name: m.name, dosage: m.dosage })),
      emergencyNotes: profile.emergencyNotes,
      contacts: profile.emergencyContacts.map(({ name, phone, relationship }) => ({
        name,
        phone,
        relationship,
      })),
      emergencyPublic: profile.emergencyPublic,
      emergencyToken: profile.emergencyToken,
    };
  }

  // ---------- Cuidadores ----------

  async listMembers(userId: string, profileId: string) {
    await this.access.assertMember(userId, profileId);
    const members = await this.prisma.profileMember.findMany({
      where: { profileId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      notifyMissedDoses: m.notifyMissedDoses,
    }));
  }

  async addMember(userId: string, profileId: string, dto: AddMemberDto) {
    await this.access.assertOwner(userId, profileId);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user) {
      throw new NotFoundException('Nenhuma conta com este e-mail. Peça para a pessoa se cadastrar.');
    }
    const exists = await this.prisma.profileMember.findUnique({
      where: { profileId_userId: { profileId, userId: user.id } },
    });
    if (exists) throw new ConflictException('Esta pessoa já tem acesso ao perfil');

    await this.prisma.profileMember.create({
      data: {
        profileId,
        userId: user.id,
        role: ProfileRole.CAREGIVER,
        notifyMissedDoses: dto.notifyMissedDoses ?? true,
      },
    });
    return this.listMembers(userId, profileId);
  }

  async removeMember(userId: string, profileId: string, memberUserId: string) {
    // O responsável remove qualquer cuidador; o cuidador pode sair sozinho.
    if (memberUserId !== userId) await this.access.assertOwner(userId, profileId);
    const member = await this.access.assertMember(memberUserId, profileId);
    if (member.role === ProfileRole.OWNER) {
      throw new BadRequestException('O responsável não pode ser removido do perfil');
    }
    await this.prisma.profileMember.delete({ where: { id: member.id } });
  }

  async updateMyMembership(userId: string, profileId: string, dto: UpdateMyMembershipDto) {
    const member = await this.access.assertMember(userId, profileId);
    return this.prisma.profileMember.update({
      where: { id: member.id },
      data: { notifyMissedDoses: dto.notifyMissedDoses },
    });
  }

  private validateTimezone(timezone?: string) {
    if (timezone && !DateTime.now().setZone(timezone).isValid) {
      throw new BadRequestException(`Fuso horário inválido: ${timezone}`);
    }
  }
}
