import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { TipoMovimentacaoEstoque } from '@prisma/client';

export class CreateMovimentacaoEstoqueDto {
  // ID do produto que sofrerá a movimentação no estoque
  @IsInt({ message: 'O ID do produto deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID do produto é obrigatório.' })
  produtoId: number;

  // Tipo da movimentação (valida os enums cadastrados no schema.prisma)
  @IsEnum(TipoMovimentacaoEstoque, { message: 'Tipo de movimentação inválido.' })
  @IsNotEmpty({ message: 'O tipo da movimentação é obrigatório.' })
  tipo: TipoMovimentacaoEstoque;

  // Quantidade de itens movimentados
  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'A quantidade é obrigatória.' })
  quantidade: number;

  // Motivo / Justificativa da movimentação
  @IsString({ message: 'O motivo deve ser um texto.' })
  @IsOptional()
  motivo?: string;

  // Observações adicionais
  @IsString({ message: 'A observação deve ser um texto.' })
  @IsOptional()
  observacao?: string;
}
