import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from './auth.guard';

export function extractUserFromContext(context: ExecutionContext): AuthenticatedUser | undefined {
  const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  return request.user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return extractUserFromContext(ctx);
  },
);
