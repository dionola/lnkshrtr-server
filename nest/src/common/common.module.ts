import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './guards/auth.guard';
import { OptionalAuthGuard } from './guards/optional-auth.guard';

@Global()
@Module({
  providers: [AuthGuard, OptionalAuthGuard],
  exports: [AuthGuard, OptionalAuthGuard],
})
export class CommonModule {}
