export function resolveJwtSecret(explicit?: string): string {
  const secret = explicit || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret === 'nexo_default_jwt_secret_dev')) {
    throw new Error('JWT_SECRET seguro deve estar configurado em produção.');
  }
  return secret || 'nexo_default_jwt_secret_dev';
}
