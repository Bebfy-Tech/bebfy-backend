-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "StatusEmpresa" AS ENUM ('ATIVA', 'SUSPENSA', 'CANCELADA', 'EM_TESTE');

-- CreateEnum
CREATE TYPE "TipoPlano" AS ENUM ('VAREJO_BASICO', 'VAREJO_PRO', 'ATACADO_FULL', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "NomeModulo" AS ENUM ('CAIXA_PDV', 'FIADOS', 'VASILHAMES_RETORNAVEIS', 'ENTREGAS_DELIVERY', 'PEDIDOS_ATACADO', 'TABELA_PRECO_VOLUME', 'ROTAS_CAMINHOES', 'CREDITO_B2B', 'ESTOQUE_LOTES', 'COMPRAS_FORNECEDORES', 'RELATORIOS_AVANCADOS');

-- CreateEnum
CREATE TYPE "StatusAcerto" AS ENUM ('CONCLUIDO', 'PENDENTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Cargo" ADD VALUE 'ADMINISTRADOR';
ALTER TYPE "Cargo" ADD VALUE 'FUNCIONARIO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimentacaoEstoque" ADD VALUE 'AJUSTE_ENTRADA';
ALTER TYPE "TipoMovimentacaoEstoque" ADD VALUE 'AJUSTE_SAIDA';
ALTER TYPE "TipoMovimentacaoEstoque" ADD VALUE 'PERDA';
ALTER TYPE "TipoMovimentacaoEstoque" ADD VALUE 'AVARIA';

-- DropForeignKey
ALTER TABLE "HistoricoCusto" DROP CONSTRAINT "HistoricoCusto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemNotaFiscal" DROP CONSTRAINT "ItemNotaFiscal_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "ItemVenda" DROP CONSTRAINT "ItemVenda_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "LoteProduto" DROP CONSTRAINT "LoteProduto_produtoId_fkey";

-- DropForeignKey
ALTER TABLE "MovimentacaoEstoque" DROP CONSTRAINT "MovimentacaoEstoque_produtoId_fkey";

-- DropIndex
DROP INDEX "Categoria_nome_key";

-- DropIndex
DROP INDEX "Cliente_cpfCnpj_key";

-- DropIndex
DROP INDEX "Fornecedor_cnpj_key";

-- DropIndex
DROP INDEX "Funcionario_cpf_key";

-- DropIndex
DROP INDEX "NotaFiscal_chaveAcesso_key";

-- DropIndex
DROP INDEX "Produto_codigoBarras_key";

-- AlterTable
ALTER TABLE "Caixa" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "empresaId" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "empresaId" INTEGER NOT NULL,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'FISICA';

-- AlterTable
ALTER TABLE "ConfigGlobal" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ContaPagar" ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ContaReceber" ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Fornecedor" ADD COLUMN     "empresaId" INTEGER NOT NULL,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "tipoPessoa" "TipoPessoa" NOT NULL DEFAULT 'JURIDICA';

-- AlterTable
ALTER TABLE "Funcionario" ADD COLUMN     "codigo" INTEGER,
ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "HistoricoCusto" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ItemNotaFiscal" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ItemVenda" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "LoteProduto" DROP CONSTRAINT "LoteProduto_pkey",
ADD COLUMN     "empresaId" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" INTEGER NOT NULL,
ADD CONSTRAINT "LoteProduto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN     "empresaId" INTEGER NOT NULL,
ADD COLUMN     "observacao" TEXT,
DROP COLUMN "produtoId",
ADD COLUMN     "produtoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "NotaFiscal" ADD COLUMN     "empresaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PagamentoVenda" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Produto" DROP CONSTRAINT "Produto_pkey",
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "empresaId" INTEGER NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "fardoQuantidade" SET DEFAULT 1,
ADD CONSTRAINT "Produto_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Venda" ADD COLUMN     "empresaId" INTEGER NOT NULL,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "statusAcerto" "StatusAcerto" NOT NULL DEFAULT 'CONCLUIDO';

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nomeFantasia" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "cnpj" TEXT,
    "slug" TEXT NOT NULL,
    "subdominio" TEXT,
    "status" "StatusEmpresa" NOT NULL DEFAULT 'ATIVA',
    "planoId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoPlano" NOT NULL DEFAULT 'VAREJO_BASICO',
    "precoMensal" DECIMAL(10,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa_modulos" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "modulo" "NomeModulo" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_modulos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" TEXT,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_cascos" (
    "id" TEXT NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_cascos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_cnpj_key" ON "empresas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_subdominio_key" ON "empresas"("subdominio");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_modulos_empresaId_modulo_key" ON "empresa_modulos"("empresaId", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_empresaId_nome_key" ON "Categoria"("empresaId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_cpfCnpj_key" ON "Cliente"("empresaId", "cpfCnpj");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigGlobal_empresaId_key" ON "ConfigGlobal"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_empresaId_cnpj_key" ON "Fornecedor"("empresaId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_empresaId_cpf_key" ON "Funcionario"("empresaId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_empresaId_codigo_key" ON "Funcionario"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_empresaId_chaveAcesso_key" ON "NotaFiscal"("empresaId", "chaveAcesso");

-- CreateIndex
CREATE INDEX "Produto_empresaId_codigoBarras_idx" ON "Produto"("empresaId", "codigoBarras");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_empresaId_codigoBarras_key" ON "Produto"("empresaId", "codigoBarras");

-- AddForeignKey
ALTER TABLE "empresas" ADD CONSTRAINT "empresas_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "planos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa_modulos" ADD CONSTRAINT "empresa_modulos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigGlobal" ADD CONSTRAINT "ConfigGlobal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduto" ADD CONSTRAINT "LoteProduto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteProduto" ADD CONSTRAINT "LoteProduto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoCusto" ADD CONSTRAINT "HistoricoCusto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNotaFiscal" ADD CONSTRAINT "ItemNotaFiscal_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemVenda" ADD CONSTRAINT "ItemVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_cascos" ADD CONSTRAINT "movimentacoes_cascos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_cascos" ADD CONSTRAINT "movimentacoes_cascos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_cascos" ADD CONSTRAINT "movimentacoes_cascos_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

