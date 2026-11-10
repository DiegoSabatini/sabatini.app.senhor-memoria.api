import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConfirmDoseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class DayQueryDto {
  /** Dia (YYYY-MM-DD) no fuso do perfil. Padrão: hoje. */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpcomingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  hours?: number;
}

export class AdherenceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
