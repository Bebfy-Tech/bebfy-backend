import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsPositive, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MapeamentoItemNfeDto {
  @IsInt()
  @IsPositive()
  numeroItem: number;

  @IsInt()
  @IsPositive()
  produtoId: number;
}

export class ImportarNfeDto {
  @IsString()
  @MaxLength(2_000_000)
  xml: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => MapeamentoItemNfeDto)
  mapeamentos?: MapeamentoItemNfeDto[];
}
