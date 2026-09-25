import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';
import { AppRole, ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: { id: string; email?: string };
      params?: Record<string, string>;
    }>();

    const user = req.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('Usuário não autenticado.');
    }

    // ADMIN global possui acesso irrestrito
    const isAdmin = await this.accessControl.isAdmin(user.id);
    if (isAdmin) {
      return true;
    }

    if (requiredRoles.includes('ADMIN') && !requiredRoles.some((r) => r !== 'ADMIN')) {
      throw new ForbiddenException('Acesso restrito a administradores.');
    }

    const teamId = req.params?.['id'] || req.params?.['teamId'];

    if (requiredRoles.includes('LEADER')) {
      if (teamId) {
        const isLeader = await this.accessControl.isTeamLeader(user.id, teamId);
        if (isLeader) {
          return true;
        }
      }
    }

    if (requiredRoles.includes('MEMBER')) {
      if (teamId) {
        const isMember = await this.accessControl.isTeamMember(user.id, teamId);
        if (isMember) {
          return true;
        }
      } else {
        return true;
      }
    }

    throw new ForbiddenException('Acesso negado: permissões insuficientes para esta operação.');
  }
}
