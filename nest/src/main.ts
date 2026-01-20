import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: env.NODE_ENV === 'test' ? false : ['log', 'error', 'warn'],
  });

  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api', { exclude: [
    { path: 'health', method: RequestMethod.ALL },
    { path: 'health/*path', method: RequestMethod.ALL },
  ] });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(env.PORT);
}

bootstrap();
