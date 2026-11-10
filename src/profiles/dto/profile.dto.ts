import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** Data de nascimento (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  /** Fuso horário IANA. Padrão: America/Sao_Paulo. */
  @IsOptional()
  @IsString()
  timezone?: string;

  /** true quando o perfil é da própria pessoa que está criando (ela recebe os lembretes). */
  @IsOptional()
  @IsBoolean()
  isSelf?: boolean;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  /** Minutos após o horário para lembrar de novo a pessoa. */
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  reminderRetryMinutes?: number;

  /** Minutos após o horário para avisar os cuidadores. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(720)
  caregiverAlertMinutes?: number;
}

export class EmergencyContactDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(8)
  phone: string;

  @IsOptional()
  @IsString()
  relationship?: string;
}

export class UpdateEmergencyCardDto {
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  allergies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  conditions?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  emergencyNotes?: string | null;

  /** Permite abrir o cartão pelo link/QR code sem login. */
  @IsOptional()
  @IsBoolean()
  emergencyPublic?: boolean;

  /** Substitui a lista de contatos de emergência. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactDto)
  contacts?: EmergencyContactDto[];
}

export class AddMemberDto {
  /** E-mail de uma conta já cadastrada no app. */
  @IsEmail()
  email: string;

  @IsOptional()
  @IsBoolean()
  notifyMissedDoses?: boolean;
}

export class UpdateMyMembershipDto {
  @IsBoolean()
  notifyMissedDoses: boolean;
}
