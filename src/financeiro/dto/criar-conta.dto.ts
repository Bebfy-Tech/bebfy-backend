import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CriarContaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  descricao: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsDateString()
  dataVencimento: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoria?: string;
}
