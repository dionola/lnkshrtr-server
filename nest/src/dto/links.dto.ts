import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MinLength, ValidateIf } from 'class-validator';

export class CreateLinkDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'URL must be a valid http or https address' })
  url: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  customCode?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isPasswordProtected?: boolean;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.isPasswordProtected === true)
  @MinLength(6, { message: 'Password must be at least 6 characters when protection is enabled' })
  password?: string | null;

  @IsOptional()
  @IsIn(['link'])
  type?: string;
}

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPasswordProtected?: boolean;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.isPasswordProtected === true && o.password != null)
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string | null;
}

export class VerifyPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

export class GetLinksQueryDto {
  @IsOptional()
  @IsIn(['link'])
  type?: 'link';
}
