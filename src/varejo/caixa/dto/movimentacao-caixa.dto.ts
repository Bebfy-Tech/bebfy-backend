// Importamos os validadores e o Enum de Movimentação do Prisma
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TipoMovimentacaoCaixa } from '@prisma/client';

export class MovimentacaoCaixaDto {
  // Tipo de movimentação: 'SUPRIMENTO' (entrada de dinheiro) ou 'SANGRIA' (retirada) - Obrigatório
  @IsEnum(TipoMovimentacaoCaixa, {
    message: 'O tipo deve ser SUPRIMENTO ou SANGRIA.',
  })
  @IsNotEmpty({ message: 'O tipo de movimentação é obrigatório.' })
  tipo: TipoMovimentacaoCaixa;

  // Valor em reais (R$) da operação - Campo Obrigatório
  @IsNumber({}, { message: 'O valor deve ser um número válido.' })
  @IsNotEmpty({ message: 'O valor da movimentação é obrigatório.' })
  valor: number;

  // Categoria da movimentação (ex: "Troco", "Pagamento Fornecedor", "Retirada de Segurança") - Obrigatório
  @IsString({ message: 'A categoria deve ser um texto.' })
  @IsNotEmpty({ message: 'A categoria é obrigatória.' })
  categoria: string;

  // Observação complementar sobre a retirada ou entrada - Opcional
  @IsString({ message: 'A observação deve ser um texto.' })
  @IsOptional()
  observacao?: string;
}
