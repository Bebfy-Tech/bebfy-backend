import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { FormaPagamento } from '@prisma/client';

export class CreatePagamentoVendaDto {
  @IsEnum(FormaPagamento, { message: 'Forma de pagamento inválida.' })
  @IsNotEmpty({ message: 'A forma de pagamento é obrigatória.' })
  formaPagamento: FormaPagamento;

  @IsNumber({}, { message: 'O valor do pagamento deve ser um número.' })
  @IsNotEmpty({ message: 'O valor do pagamento é obrigatório.' })
  valor: number;

  @IsNumber({}, { message: 'O troco deve ser um número.' })
  @IsOptional()
  troco?: number;
}
