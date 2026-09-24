import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

export interface GooglePayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export abstract class GoogleTokenVerifier {
  abstract verify(idToken: string): Promise<GooglePayload>;
}

@Injectable()
export class GoogleAuthLibraryVerifier extends GoogleTokenVerifier {
  private client: OAuth2Client;
  private clientId?: string;

  constructor() {
    super();
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GooglePayload> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId || undefined,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new UnauthorizedException('Token do Google não contém as informações necessárias (sub/email).');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(`Falha ao validar credencial do Google: ${err.message}`);
    }
  }
}
