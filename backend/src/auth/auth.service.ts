import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '../users/user.repository';
import { GoogleTokenVerifier } from './google-verifier';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly googleVerifier: GoogleTokenVerifier,
    jwtSecret?: string,
  ) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'nexo_default_jwt_secret_dev';
  }

  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    if (!idToken || typeof idToken !== 'string') {
      throw new UnauthorizedException('Token do Google é obrigatório.');
    }

    let payload;
    try {
      payload = await this.googleVerifier.verify(idToken);
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new UnauthorizedException(`Credencial do Google inválida: ${err.message}`);
    }

    const user = await this.userRepository.findByEmail(payload.email);

    if (!user) {
      throw new ForbiddenException('Acesso restrito: usuário não cadastrado na plataforma.');
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

    const token = this.generateToken(user.id, user.email);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
      return jwt.verify(token, this.jwtSecret) as { sub: string; email: string };
    } catch {
      throw new UnauthorizedException('Token de autenticação inválido ou expirado.');
    }
  }
}
