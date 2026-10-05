import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '../users/user.repository';
import { GoogleTokenVerifier } from './google-verifier';
import { resolveJwtSecret } from '../common/auth/jwt-config';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly googleVerifier: GoogleTokenVerifier,
    @Optional() jwtSecret?: string,
  ) {
    this.jwtSecret = resolveJwtSecret(jwtSecret);
  }

  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException('Token do Google é obrigatório.');
    }

    let payload;
    try {
      payload = await this.googleVerifier.verify(idToken);
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new UnauthorizedException('Credencial do Google inválida. Tente entrar novamente.');
    }

    const user = await this.userRepository.findByEmail(payload.email);

    if (!user) {
      throw new ForbiddenException('Acesso restrito: usuário não cadastrado na plataforma.');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Acesso bloqueado: usuário inativo. Entre em contato com o administrador.');
    }

    await this.userRepository.updateGoogleAuth(user.id, {
      googleSubject: payload.sub,
      avatarUrl: payload.picture,
      name: payload.name,
    });

    const token = this.generateToken(user.id, user.email);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: payload.name || user.name,
        role: user.role,
        avatarUrl: payload.picture ?? user.avatarUrl,
      },
    };
  }

  async devLogin(email: string): Promise<AuthResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Dev login indisponível em ambiente de produção.');
    }

    if (!email || typeof email !== 'string') {
      throw new UnauthorizedException('E-mail é obrigatório para dev login.');
    }

    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new NotFoundException(`Usuário com e-mail "${email}" não encontrado.`);
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Acesso bloqueado: usuário inativo. Entre em contato com o administrador.');
    }

    const token = this.generateToken(user.id, user.email);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  generateToken(userId: string, email: string): string {
    return jwt.sign(
      {
        sub: userId,
        email,
      },
      this.jwtSecret,
      { expiresIn: '7d' },
    );
  }

  verifyToken(token: string): { sub: string; email: string } {
    try {
      const payload = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.sub !== 'string' || !payload.sub.trim()
        || typeof payload.email !== 'string') throw new Error('Invalid JWT payload');
      return { sub: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido ou expirado.');
    }
  }
}
