// Importamos os validadores do class-validator para garantir a integridade dos dados enviados na requisição
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProdutoDto {
  // Nome principal do produto (ex: "Cerveja Heineken 600ml") - Campo Obrigatório
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome do produto é obrigatório.' })
  nome: string;

  // Código de barras EAN/GTIN para leitura no caixa/PDV - Opcional
  @IsString({ message: 'O código de barras deve ser um texto.' })
  @IsOptional()
  codigoBarras?: string;

  // Volume do produto em mililitros (ex: 600, 350, 1000) - Opcional
  @IsInt({ message: 'O volume em ML deve ser um número inteiro.' })
  @IsOptional()
  ml?: number;

  // Unidade de medida comercial (ex: "UN", "CX", "FARDO", "L") - Opcional
  @IsString({ message: 'A unidade de medida deve ser um texto.' })
  @IsOptional()
  unidadeMedida?: string;

  // Quantidade de garrafas/latas por fardo ou caixa fechada - Opcional
  @IsInt({ message: 'A quantidade por fardo deve ser um número inteiro.' })
  @IsOptional()
  fardoQuantidade?: number;

  // Valor pago ao fornecedor por unidade (utilizado para cálculo de lucro) - Opcional
  @IsNumber({}, { message: 'O preço de custo deve ser um valor numérico.' })
  @IsOptional()
  precoCusto?: number;

  // Preço de venda unitário para o cliente final - Campo Obrigatório
  @IsNumber({}, { message: 'O preço de venda de varejo deve ser um valor numérico.' })
  @IsNotEmpty({ message: 'O preço de venda de varejo é obrigatório.' })
  precoVendaVarejo: number;

  // Preço diferenciado para compras em lote/fardo fechado - Opcional
  @IsNumber({}, { message: 'O preço de venda de atacado deve ser um valor numérico.' })
  @IsOptional()
  precoVendaAtacado?: number;

  // Quantidade de unidades necessárias para ativar o preço de atacado - Opcional
  @IsInt({ message: 'A quantidade mínima de atacado deve ser um número inteiro.' })
  @IsOptional()
  qtdAtacadoMinima?: number;

  // Quantidade disponível física no estoque inicial - Opcional
  @IsInt({ message: 'O estoque atual deve ser um número inteiro.' })
  @IsOptional()
  estoqueAtual?: number;

  // Limite mínimo para alerta de reposição de estoque no painel - Opcional
  @IsInt({ message: 'O estoque mínimo deve ser um número inteiro.' })
  @IsOptional()
  estoqueMinimo?: number;

  // Indica se a embalagem/garrafa precisa ser devolvida pelo cliente - Opcional
  @IsBoolean({ message: 'O campo retornável deve ser verdadeiro ou falso.' })
  @IsOptional()
  retornavel?: boolean;

  // ID da Categoria vinculada (UUID que faz a relação com a tabela Categoria) - Opcional
  @IsString({ message: 'O ID da categoria deve ser um texto/UUID válido.' })
  @IsOptional()
  categoriaId?: string;
}