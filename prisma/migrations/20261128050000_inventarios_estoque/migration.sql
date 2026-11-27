CREATE TYPE "StatusInventarioEstoque" AS ENUM ('ABERTO','FECHADO','CANCELADO');
CREATE TABLE "InventarioEstoque" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "empresaId" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "status" "StatusInventarioEstoque" NOT NULL DEFAULT 'ABERTO',
 "revisao" INTEGER NOT NULL DEFAULT 0,
 "abertoPorId" TEXT NOT NULL,
 "encerradoPorId" TEXT,
 "motivoEncerramento" TEXT,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "encerradoEm" TIMESTAMP(3),
 "atualizadoEm" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "InventarioEstoque_empresaId_criadoEm_idx" ON "InventarioEstoque"("empresaId","criadoEm");
-- Somente um inventário aberto por empresa, inclusive sob concorrência.
CREATE UNIQUE INDEX "InventarioEstoque_um_aberto" ON "InventarioEstoque"("empresaId") WHERE "status" = 'ABERTO';
CREATE TABLE "ItemInventarioEstoque" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "inventarioId" TEXT NOT NULL REFERENCES "InventarioEstoque"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "produtoId" INTEGER NOT NULL REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "nome" TEXT NOT NULL,
 "codigoBarras" TEXT,
 "saldoInicial" INTEGER NOT NULL,
 "produtoAtualizadoEm" TIMESTAMP(3) NOT NULL,
 "contagem" INTEGER CHECK ("contagem" >= 0),
 "contadoPorId" TEXT,
 "contadoEm" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "ItemInventarioEstoque_inventarioId_produtoId_key" ON "ItemInventarioEstoque"("inventarioId","produtoId");
