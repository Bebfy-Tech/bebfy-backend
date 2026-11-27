ALTER TYPE "StatusEntrega" ADD VALUE 'NAO_ENTREGUE';
ALTER TABLE "Venda" ADD COLUMN "entregadorId" TEXT, ADD COLUMN "saidaEntregaEm" TIMESTAMP(3), ADD COLUMN "entregueEm" TIMESTAMP(3), ADD COLUMN "acertoEm" TIMESTAMP(3), ADD COLUMN "acertoOperadorId" TEXT;
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_entregadorId_fkey" FOREIGN KEY ("entregadorId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "EventoEntrega" (
 "id" TEXT NOT NULL, "vendaId" TEXT NOT NULL, "status" "StatusEntrega" NOT NULL,
 "entregadorId" TEXT, "operadorId" TEXT, "observacao" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "EventoEntrega_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "EventoEntrega_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EventoEntrega_vendaId_criadoEm_idx" ON "EventoEntrega"("vendaId","criadoEm");
-- Old sales retain their actual status (including null); no inferred delivery dates.
