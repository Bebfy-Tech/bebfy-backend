CREATE TABLE "RecebimentoCompra" (
  "id" TEXT PRIMARY KEY,
  "empresaId" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "compraId" TEXT NOT NULL REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "total" DECIMAL(65,30) NOT NULL CHECK ("total">=0),
  "observacao" TEXT NOT NULL,
  "operadorId" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL UNIQUE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RecebimentoCompra_compraId_idx" ON "RecebimentoCompra"("compraId");
CREATE INDEX "RecebimentoCompra_empresaId_criadoEm_idx" ON "RecebimentoCompra"("empresaId","criadoEm");
CREATE TABLE "ItemRecebimentoCompra" (
  "id" TEXT PRIMARY KEY,
  "recebimentoId" TEXT NOT NULL REFERENCES "RecebimentoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "itemCompraId" TEXT NOT NULL REFERENCES "ItemCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "unidades" INTEGER NOT NULL CHECK ("unidades">0),
  "valor" DECIMAL(65,30) NOT NULL CHECK ("valor">=0),
  "estoqueAnterior" INTEGER NOT NULL,
  "estoquePosterior" INTEGER NOT NULL,
  CHECK ("estoquePosterior"::bigint="estoqueAnterior"::bigint+"unidades")
);
CREATE UNIQUE INDEX "ItemRecebimentoCompra_recebimentoId_itemCompraId_key" ON "ItemRecebimentoCompra"("recebimentoId","itemCompraId");
