import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  /** Telefone com DDI, ex.: +5511999999999 (usado no WhatsApp). */
  @IsOptional()
  @IsString()
  phone?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RegisterDeviceDto {
  /** Token de push do Expo (ExponentPushToken[...]). */
  @IsString()
  pushToken: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}
