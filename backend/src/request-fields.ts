import { BadRequestException } from '@nestjs/common';

export function fields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Envie um objeto JSON válido.');
  }
  return value as Record<string, unknown>;
}

export function requiredText(body: Record<string, unknown>, name: string, max = 2000): string {
  const value = body[name];
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`O campo ${name} deve ter entre 1 e ${max} caracteres.`);
  }
  return value.trim();
}

export function optionalText(body: Record<string, unknown>, name: string, max = 2000): string | null {
  const value = body[name];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new BadRequestException(`O campo ${name} deve ter até ${max} caracteres.`);
  }
  return value.trim() || null;
}
