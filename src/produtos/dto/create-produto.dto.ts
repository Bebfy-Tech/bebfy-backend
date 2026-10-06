// DTO atualizado para refletir os campos reais da tabela Produto no Prisma
export class CreateProdutoDto {
  nome: string;                 // Nome do produto (ex: Cerveja Heineken 600ml)
  codigoBarras?: string;        // Código de barras (opcional)
  ml?: number;                  // Volume em ML (opcional)
  unidadeMedida?: string;       // Unidade (ex: "UN", "CX")
  fardoQuantidade?: number;     // Quantidade por fardo (opcional)
  precoCusto?: number;          // Preço de custo
  precoVendaVarejo: number;     // Preço de venda unitário
  precoVendaAtacado?: number;   // Preço para atacado (opcional)
  qtdAtacadoMinima?: number;    // Quantidade mínima para aplicar preço de atacado
  estoqueAtual?: number;        // Quantidade disponível em estoque
  estoqueMinimo?: number;       // Alerta de estoque mínimo
  retornavel?: boolean;         // Indica se a embalagem é retornável
}