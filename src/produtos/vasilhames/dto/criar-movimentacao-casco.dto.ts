import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

enum TipoMovimentacaoCascoDto {
  EMPRESTIMO_SAIDA = 'EMPRESTIMO_SAIDA',
  DEVOLUCAO_ENTRADA = 'DEVOLUCAO_ENTRADA',
  QUEBRA_AVARIA = 'QUEBRA_AVARIA',
}

export class CriarMovimentacaoCascoDto {
  @IsNotEmpty({ message: 'O ID do cliente é obrigatório.' })
  @IsString()
  clienteId: string;

  @IsNotEmpty({ message: 'O ID do produto/vasilhame é obrigatório.' })
  @IsInt()
  produtoId: number;

  @IsNotEmpty({ message: 'A quantidade é obrigatória.' })
  @IsInt()
  @Min(1, { message: 'A quantidade deve ser de no mínimo 1.' })
  quantidade: number;

  @IsNotEmpty({ message: 'O tipo de movimentação é obrigatório.' })
  @IsEnum(TipoMovimentacaoCascoDto, { message: 'Tipo de movimentação inválido.' })
  tipo: TipoMovimentacaoCascoDto;

  @IsOptional()
  @IsString()
  observacao?: string;
}