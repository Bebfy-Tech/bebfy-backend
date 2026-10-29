import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FormaPagamento, TipoEntrega } from '@prisma/client';

export class CreateItemVendaDto {
  @IsNumber({}, { message: 'O ID do produto deve ser um número.' })
  @IsNotEmpty({ message: 'O ID do produto é obrigatório.' })
  produtoId: number;

  @IsNumber({}, { message: 'A quantidade deve ser um número.' })
  @IsNotEmpty({ message: 'A quantidade é obrigatória.' })
  quantidade: number;

  @IsNumber({}, { message: 'O preço unitário deve ser um número.' })
  @IsNotEmpty({ message: 'O preço unitário é obrigatório.' })
  precoUnitario: number;

  @IsOptional()
  @IsBoolean({ message: 'isFardo deve ser verdadeiro ou falso.' })
  isFardo?: boolean;
}

export class CreatePagamentoVendaDto {
  @IsEnum(FormaPagamento, { message: 'Forma de pagamento inválida.' })
  formaPagamento: FormaPagamento;

  @IsNumber({}, { message: 'O valor do pagamento deve ser um número.' })
  valor: number;

  @IsOptional()
  @IsNumber({}, { message: 'O troco deve ser um número.' })
  troco?: number;
}

export class CreateVendaDto {
  @IsString({ message: 'O ID do caixa deve ser um texto/UUID.' })
  @IsNotEmpty({ message: 'O ID do caixa é obrigatório.' })
  caixaId: string;

  @IsString({ message: 'O ID do funcionário deve ser um texto/UUID.' })
  @IsNotEmpty({ message: 'O ID do funcionário é obrigatório.' })
  funcionarioId: string;

  @IsString({ message: 'O ID do cliente deve ser um texto/UUID.' })
  @IsOptional()
  clienteId?: string;

  @IsNumber({}, { message: 'O valor do desconto deve ser um número.' })
  @IsOptional()
  desconto?: number;

  @IsEnum(TipoEntrega, { message: 'Tipo de entrega inválido.' })
  @IsOptional()
  tipoEntrega?: TipoEntrega;

  @IsNumber({}, { message: 'A taxa de entrega deve ser um número.' })
  @IsOptional()
  taxaEntrega?: number;

  @IsString({ message: 'O endereço de entrega deve ser um texto.' })
  @IsOptional()
  enderecoEntrega?: string;

  @IsOptional()
  @IsNumber({}, { message: 'A quantidade de cascos devolvidos deve ser um número.' })
  cascosDevolvidos?: number;

  @IsArray({ message: 'Os itens devem ser uma lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemVendaDto)
  itens: CreateItemVendaDto[];

  @IsArray({ message: 'Os pagamentos devem ser uma lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreatePagamentoVendaDto)
  pagamentos: CreatePagamentoVendaDto[];
}