import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProfileRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Garante que um usuário só acesse perfis dos quais é membro.
 * Dados de saúde são sensíveis (LGPD): toda rota de perfil passa por aqui.
 */
@Injectable()
export class ProfileAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(userId: string, profileId: string, roles?: ProfileRole[]) {
    const member = await this.prisma.profileMember.findUnique({
      where: { profileId_userId: { profileId, userId } },
    });
    // 404 em vez de 403 para não revelar que o perfil existe.
    if (!member) throw new NotFoundException('Perfil não encontrado');
    if (roles && !roles.includes(member.role)) {
      throw new ForbiddenException('Apenas o responsável pelo perfil pode fazer isso');
    }
    return member;
  }

  assertOwner(userId: string, profileId: string) {
    return this.assertMember(userId, profileId, [ProfileRole.OWNER]);
  }
}
