import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Load .env before we read TLS paths (this runs before Nest's ConfigModule).
loadEnv();

/**
 * Optional TLS. When TLS_CERT_FILE + TLS_KEY_FILE are set the API + Socket.io
 * gateway are served over HTTPS/WSS. This is REQUIRED for the browser softphone
 * when the app is reached by IP (not localhost): getUserMedia (microphone) only
 * works in a "secure context", so the whole origin must be HTTPS.
 */
function readHttpsOptions() {
  const cert = process.env.TLS_CERT_FILE;
  const key = process.env.TLS_KEY_FILE;
  if (!cert || !key) return undefined;
  return { cert: readFileSync(cert), key: readFileSync(key) };
}

async function bootstrap() {
  const httpsOptions = readHttpsOptions();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    ...(httpsOptions ? { httpsOptions } : {}),
  });

  // Structured logging via pino (replaces the default Nest logger).
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const appCfg = config.get<AppConfig>('app')!;

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: appCfg.corsOrigins.length ? appCfg.corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties not declared on the DTO (rather than 409-rejecting the
      // whole request). Declared fields are still fully validated.
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableShutdownHooks();

  await app.listen(appCfg.port, appCfg.host);
  const scheme = httpsOptions ? 'https' : 'http';
  app
    .get(Logger)
    .log(`PBX backend listening on ${scheme}://${appCfg.host}:${appCfg.port}/api`);
}

bootstrap().catch((err) => {
  // Last-resort: never swallow a boot failure.
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
