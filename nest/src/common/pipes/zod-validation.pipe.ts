import { PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    return this.schema.parse(value);
  }
}
