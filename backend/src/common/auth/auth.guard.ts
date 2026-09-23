import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    if (req.user && req.user.id) {
      return true;
    }

    const headerUserId = req.headers?.['x-user-id'];
    const userId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId;

    if (typeof userId === 'string' && userId.trim()) {
      req.user = { id: userId.trim() };
      return true;
    }

    throw new UnauthorizedException('Usuário não autenticado. Forneça credenciais ou o cabeçalho x-user-id.');
  }
}
