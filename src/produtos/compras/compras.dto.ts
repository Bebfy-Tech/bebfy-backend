import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ItemPedidoDto {
  @IsInt() @Min(1) produtoId: number;
  @IsIn(['BASE', 'EMBALAGEM']) modo: 'BASE' | 'EMBALAGEM';
  @IsInt() @Min(1) @Max(1000000) quantidade: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(999999999) custoEmbalagem: number;
}
export class CriarCompraDto {
  @IsString() @IsNotEmpty() fornecedorId: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) previsaoEntrega?: string;
  @IsOptional() @IsString() @MaxLength(1000) observacao?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999) frete: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(999999999) desconto: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ItemPedidoDto) itens: ItemPedidoDto[];
  @IsUUID('4') chaveOperacao: string;
}
export class EncerrarCompraDto {
  @IsString() @IsNotEmpty() @MaxLength(500) motivo: string;
}
