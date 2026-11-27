-- Somente novas vendas terão o custo capturado na transação.
-- Não preencher o histórico anterior com valores atuais.
CREATE TABLE "ItemVendaCusto" (
  "itemVendaId" TEXT NOT NULL,
  "custoUnitario" DECIMAL(65,30) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemVendaCusto_pkey" PRIMARY KEY ("itemVendaId"),
  CONSTRAINT "ItemVendaCusto_itemVendaId_fkey" FOREIGN KEY ("itemVendaId") REFERENCES "ItemVenda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
