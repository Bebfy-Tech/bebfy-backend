import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

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

export class ItemRecebimentoDto {
  @IsString() @IsNotEmpty() itemCompraId: string;
  @IsInt() @Min(1) @Max(1000000000) unidades: number;
  @IsOptional() @IsString() @MaxLength(100) numeroLote?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) validade?: string;
}
export class ReceberCompraDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => ItemRecebimentoDto) itens: ItemRecebimentoDto[];
  @IsOptional() @Matches(/^\d{44}$/) chaveNfe?: string;
  @IsString() @IsNotEmpty() @MaxLength(1000) observacao: string;
  @IsBoolean() gerarContaPagar: boolean;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) vencimento?: string;
  @IsOptional() @IsInt() @Min(1) @Max(60) parcelas?: number;
  @IsUUID('4') chaveOperacao: string;
}
