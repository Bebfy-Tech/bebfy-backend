CREATE TYPE "TipoMovimentoFinanceiro" AS ENUM ('TRANSFERENCIA','CONCILIACAO');
CREATE TABLE "MovimentoFinanceiro" (
"id" TEXT NOT NULL,"empresaId" INTEGER NOT NULL,"tipo" "TipoMovimentoFinanceiro" NOT NULL,
"origemId" TEXT,"destinoId" TEXT NOT NULL,"origemNome" TEXT,"destinoNome" TEXT NOT NULL,
"pagamentoVendaId" TEXT,"historicoFiadoId" TEXT,"valor" DECIMAL(65,30) NOT NULL,"observacao" TEXT NOT NULL,"operadorId" TEXT NOT NULL,
"chaveOperacao" TEXT NOT NULL,"estornoDeId" TEXT,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "MovimentoFinanceiro_pkey" PRIMARY KEY ("id"),
CONSTRAINT "MovimentoFinanceiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "MovimentoFinanceiro_origemId_fkey" FOREIGN KEY ("origemId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "MovimentoFinanceiro_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "MovimentoFinanceiro_pagamentoVendaId_fkey" FOREIGN KEY ("pagamentoVendaId") REFERENCES "PagamentoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "MovimentoFinanceiro_historicoFiadoId_fkey" FOREIGN KEY ("historicoFiadoId") REFERENCES "HistoricoFiado"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "MovimentoFinanceiro_origem_check" CHECK (("tipo"='TRANSFERENCIA' AND "origemId" IS NOT NULL AND "origemId"<>"destinoId" AND "pagamentoVendaId" IS NULL AND "historicoFiadoId" IS NULL) OR ("tipo"='CONCILIACAO' AND "origemId" IS NULL AND (("pagamentoVendaId" IS NOT NULL) <> ("historicoFiadoId" IS NOT NULL)))),
CONSTRAINT "MovimentoFinanceiro_valor_check" CHECK (("estornoDeId" IS NULL AND "valor">0) OR ("estornoDeId" IS NOT NULL AND "valor"<0))
);
CREATE UNIQUE INDEX "MovimentoFinanceiro_chaveOperacao_key" ON "MovimentoFinanceiro"("chaveOperacao");
CREATE UNIQUE INDEX "MovimentoFinanceiro_estornoDeId_key" ON "MovimentoFinanceiro"("estornoDeId");
CREATE INDEX "MovimentoFinanceiro_empresaId_criadoEm_idx" ON "MovimentoFinanceiro"("empresaId","criadoEm");
CREATE INDEX "MovimentoFinanceiro_pagamentoVendaId_idx" ON "MovimentoFinanceiro"("pagamentoVendaId");
CREATE INDEX "MovimentoFinanceiro_historicoFiadoId_idx" ON "MovimentoFinanceiro"("historicoFiadoId");
