import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TipoEntrega } from '@prisma/client';
import { CreateItemVendaDto } from './create-item-venda.dto';
import { CreatePagamentoVendaDto } from './create-pagamento-venda.dto';

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

  @IsArray({ message: 'Os itens devem ser uma lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreateItemVendaDto)
  itens: CreateItemVendaDto[];

  @IsArray({ message: 'Os pagamentos devem ser uma lista.' })
  @ValidateNested({ each: true })
  @Type(() => CreatePagamentoVendaDto)
  pagamentos: CreatePagamentoVendaDto[];
}
