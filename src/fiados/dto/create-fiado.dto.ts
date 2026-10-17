// Importamos os validadores do class-validator e o Enum gerado pelo Prisma
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TipoTransacaoFiado } from '@prisma/client';

export class CreateFiadoDto {
  // ID do cliente vinculado à transação (UUID) - Campo Obrigatório
  @IsString({ message: 'O ID do cliente deve ser um texto/UUID válido.' })
  @IsNotEmpty({ message: 'O ID do cliente é obrigatório.' })
  clienteId: string;

  // ID da venda relacionada (caso o lançamento tenha surgido de uma venda no PDV) - Opcional
  @IsString({ message: 'O ID da venda deve ser um texto/UUID.' })
  @IsOptional()
  vendaId?: string;

  // Tipo da transação: 'DEBITO' (aumenta dívida) ou 'CREDITO' (pagamento/abatimento) - Obrigatório
  @IsEnum(TipoTransacaoFiado, {
    message: 'O tipo deve ser DEBITO ou CREDITO.',
  })
  @IsNotEmpty({ message: 'O tipo da transação é obrigatório.' })
  tipo: TipoTransacaoFiado;

  // Valor do lançamento em reais (R$) - Campo Obrigatório
  @IsNumber({}, { message: 'O valor deve ser um número válido.' })
  @IsNotEmpty({ message: 'O valor da transação é obrigatório.' })
  valor: number;

  // Descrição/Observação (ex: "Pagamento parcial em PIX", "Fiado referente à compra de fardos") - Opcional
  @IsString({ message: 'A descrição deve ser um texto.' })
  @IsOptional()
  descricao?: string;
}