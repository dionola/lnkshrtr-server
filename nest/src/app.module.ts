import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { LinksModule } from './links/links.module';
import { PublicModule } from './public/public.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 15 * 60 * 1000, limit: parseInt(process.env.THROTTLE_LIMIT ?? '500', 10) }] }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    LinksModule,
    PublicModule,
    HealthModule,
  ],
})
export class AppModule {}
