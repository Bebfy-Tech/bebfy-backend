ALTER TABLE "RecebimentoCompra" ADD COLUMN "chaveNfe" TEXT, ADD COLUMN "assinatura" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "RecebimentoCompra_empresaId_chaveNfe_key" ON "RecebimentoCompra"("empresaId","chaveNfe");
ALTER TABLE "ItemRecebimentoCompra" ADD COLUMN "custoAnterior" DECIMAL(65,30) NOT NULL DEFAULT 0, ADD COLUMN "custoNovo" DECIMAL(65,30) NOT NULL DEFAULT 0, ADD COLUMN "custoUnitario" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "ContaPagar" ADD COLUMN "recebimentoCompraId" TEXT REFERENCES "RecebimentoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ContaPagar_recebimentoCompraId_idx" ON "ContaPagar"("recebimentoCompraId");
ALTER TABLE "LoteProduto" ADD COLUMN "itemRecebimentoId" TEXT REFERENCES "ItemRecebimentoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "LoteProduto_itemRecebimentoId_key" ON "LoteProduto"("itemRecebimentoId");
