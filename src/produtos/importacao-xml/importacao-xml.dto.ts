import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class XmlPreviewDto {
  @IsString() @MinLength(50) @MaxLength(1000000)
  xml: string;
}

export class XmlItemMapDto {
  @IsInt() @Min(0) indice: number;
  @IsInt() @Min(1) produtoId: number;
}

export class XmlConfirmDto extends XmlPreviewDto {
  @IsArray() @ValidateNested({each:true}) @Type(()=>XmlItemMapDto)
  mapeamentos: XmlItemMapDto[];

  @IsOptional() @IsBoolean()
  gerarContaPagar?: boolean;

  @IsOptional() @IsISO8601()
  vencimento?: string;
}
