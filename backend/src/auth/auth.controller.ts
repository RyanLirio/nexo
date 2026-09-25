import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  async loginWithGoogle(@Body() body: { idToken?: string }) {
    return this.authService.loginWithGoogle(body?.idToken as string);
  }

  @Public()
  @Post('dev-login')
  async devLogin(@Body() body: { email?: string }) {
    return this.authService.devLogin(body?.email as string);
  }
}
