import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ScheduleDto {
  /** Horário "HH:mm", ex.: "08:00". */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time deve estar no formato HH:mm' })
  time: string;

  /** 1 = segunda ... 7 = domingo. Vazio ou ausente = todos os dias. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  daysOfWeek?: number[];
}

export class CreateMedicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** Ex.: "50 mg", "1 comprimido". */
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  dosage: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  /** YYYY-MM-DD. Padrão: hoje. */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** YYYY-MM-DD. Vazio = uso contínuo. */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerDose?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules: ScheduleDto[];
}

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Envie null para voltar a uso contínuo. */
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerDose?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Se enviado, substitui todos os horários. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ScheduleDto)
  schedules?: ScheduleDto[];
}
