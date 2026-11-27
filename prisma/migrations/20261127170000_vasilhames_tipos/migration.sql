CREATE TABLE "TipoVasilhame" (
 "id" SERIAL NOT NULL, "empresaId" INTEGER NOT NULL, "nome" TEXT NOT NULL,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TipoVasilhame_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TipoVasilhame_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TipoVasilhame_empresaId_nome_key" ON "TipoVasilhame"("empresaId","nome");
ALTER TABLE "Produto" ADD COLUMN "tipoVasilhameId" INTEGER;
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tipoVasilhameId_fkey" FOREIGN KEY ("tipoVasilhameId") REFERENCES "TipoVasilhame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Venda" ADD COLUMN "vasilhamesControlados" BOOLEAN NOT NULL DEFAULT false;
CREATE TYPE "OrigemCasco" AS ENUM ('LEGADO','EMPRESTIMO_SAIDA','DEVOLUCAO_ENTRADA','QUEBRA_AVARIA','CLASSIFICACAO','VENDA','DEVOLUCAO_PDV','ESTORNO');
ALTER TABLE "movimentacoes_cascos" ALTER COLUMN "produtoId" DROP NOT NULL,
 ADD COLUMN "tipoVasilhameId" INTEGER, ADD COLUMN "vendaId" TEXT, ADD COLUMN "origem" "OrigemCasco" NOT NULL DEFAULT 'LEGADO', ADD COLUMN "chaveOperacao" TEXT;
ALTER TABLE "movimentacoes_cascos" ADD CONSTRAINT "movimentacoes_cascos_tipoVasilhameId_fkey" FOREIGN KEY ("tipoVasilhameId") REFERENCES "TipoVasilhame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacoes_cascos" ADD CONSTRAINT "movimentacoes_cascos_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "movimentacoes_cascos_chaveOperacao_key" ON "movimentacoes_cascos"("chaveOperacao");
CREATE INDEX "movimentacoes_cascos_empresaId_clienteId_tipoVasilhameId_idx" ON "movimentacoes_cascos"("empresaId","clienteId","tipoVasilhameId");
CREATE INDEX "movimentacoes_cascos_empresaId_vendaId_idx" ON "movimentacoes_cascos"("empresaId","vendaId");
-- Do not infer historical balances by type. Existing aggregate is the unclassified balance.
