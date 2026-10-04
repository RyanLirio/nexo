import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './public.decorator';
import { resolveJwtSecret } from './jwt-config';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    @Optional() private readonly reflector?: Reflector,
    @Optional() jwtSecret?: string,
  ) {
    this.jwtSecret = resolveJwtSecret(jwtSecret);
  }

  canActivate(context: ExecutionContext): boolean {
    // 1. Permite rotas anotadas com @Public()
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }
    }

    const req = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    // 2. Se o usuário já estiver atribuído na requisição
    if (req.user && req.user.id) {
      return true;
    }

    // 3. Validação do token Bearer JWT
    const rawAuthHeader = req.headers?.['authorization'] ?? req.headers?.['Authorization'];
    const authHeader = Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : rawAuthHeader;

    if (typeof authHeader === 'string' && authHeader.trim().toLowerCase().startsWith('bearer ')) {
      const token = authHeader.trim().slice(7).trim();
      try {
        const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
        if (typeof decoded === 'object' && typeof decoded.sub === 'string' && decoded.sub.trim()) {
          req.user = {
            id: decoded.sub,
            email: typeof decoded.email === 'string' ? decoded.email : undefined,
          };
          return true;
        }
      } catch {
        throw new UnauthorizedException('Token de autenticação inválido ou expirado.');
      }
    }

    // 4. Fallback de teste via header x-user-id (APENAS em ambiente não produtivo)
    if (process.env.NODE_ENV !== 'production') {
      const headerUserId = req.headers?.['x-user-id'];
      const userId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId;

      if (typeof userId === 'string' && userId.trim()) {
        req.user = { id: userId.trim() };
        return true;
      }
    }

    throw new UnauthorizedException('Usuário não autenticado. Forneça um token Bearer válido.');
  }
}
