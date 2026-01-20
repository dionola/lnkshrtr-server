import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

let app: INestApplication | null = null;

export async function getApp(): Promise<INestApplication> {
  if (app) return app;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

export function getHttpServer() {
  if (!app) throw new Error('App not initialised — call getApp() first');
  return app.getHttpServer();
}

export async function closeApp() {
  if (app) {
    await app.close();
    app = null;
  }
}

afterAll(async () => {
  await closeApp();
});
