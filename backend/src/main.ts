import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um número entre 1 e 65535.');
  }
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = Array.from(
    new Set([
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter((o): o is string => Boolean(o)))
  );
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(port);
  console.log(`Backend Nexo rodando em http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
