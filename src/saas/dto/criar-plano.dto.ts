import { IsArray, IsEnum, IsNumber, IsOptional, IsPositive, IsString, ArrayUnique, MaxLength, MinLength } from 'class-validator';
import { NomeModulo, TipoPlano } from '@prisma/client';
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

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(NomeModulo, {each: true})
  modulosPadrao?: NomeModulo[];
}

export class AtualizarPlanoDto extends PartialType(CriarPlanoDto) {}
