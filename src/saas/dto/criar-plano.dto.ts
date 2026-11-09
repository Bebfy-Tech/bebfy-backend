import { IsEnum, IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';
import { TipoPlano } from '@prisma/client';
import { PartialType } from '@nestjs/mapped-types';

export class CriarPlanoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nome: string;

  @IsEnum(TipoPlano)
  tipo: TipoPlano;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precoMensal: number;
}

export class AtualizarPlanoDto extends PartialType(CriarPlanoDto) {}
