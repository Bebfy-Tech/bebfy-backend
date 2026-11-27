CREATE TYPE "StatusCompra" AS ENUM ('RASCUNHO','AGUARDANDO','PARCIAL','RECEBIDA','CANCELADA','ENCERRADA_PARCIAL');
CREATE TABLE "Compra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "empresaId" INTEGER NOT NULL REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "codigoCompra" SERIAL NOT NULL UNIQUE,
  "fornecedorId" TEXT NOT NULL REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fornecedorNome" TEXT NOT NULL,
  "status" "StatusCompra" NOT NULL DEFAULT 'RASCUNHO',
  "previsaoEntrega" TIMESTAMP(3),
  "observacao" TEXT,
  "subtotal" DECIMAL(65,30) NOT NULL,
  "frete" DECIMAL(65,30) NOT NULL,
  "desconto" DECIMAL(65,30) NOT NULL,
  "total" DECIMAL(65,30) NOT NULL,
  "operadorId" TEXT NOT NULL,
  "chaveOperacao" TEXT NOT NULL UNIQUE,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmadoEm" TIMESTAMP(3),
  "confirmadoPor" TEXT,
  "encerradoEm" TIMESTAMP(3),
  "encerradoPor" TEXT,
  "motivoEncerramento" TEXT,
  CHECK ("subtotal">0 AND "frete">=0 AND "desconto">=0 AND "total">0 AND "total"="subtotal"+"frete"-"desconto")
);
CREATE INDEX "Compra_empresaId_status_criadoEm_idx" ON "Compra"("empresaId","status","criadoEm");
CREATE INDEX "Compra_fornecedorId_idx" ON "Compra"("fornecedorId");
CREATE TABLE "ItemCompra" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "compraId" TEXT NOT NULL REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "produtoId" INTEGER NOT NULL REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "produtoNome" TEXT NOT NULL,
  "unidadeBase" TEXT NOT NULL,
  "unidadeCompra" TEXT NOT NULL,
  "fator" INTEGER NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "unidades" INTEGER NOT NULL,
  "unidadesRecebidas" INTEGER NOT NULL DEFAULT 0,
  "custoEmbalagem" DECIMAL(65,30) NOT NULL,
  "subtotal" DECIMAL(65,30) NOT NULL,
  "total" DECIMAL(65,30) NOT NULL,
  CHECK ("fator">0 AND "quantidade">0 AND "unidades"="fator"::bigint*"quantidade" AND "unidadesRecebidas" BETWEEN 0 AND "unidades" AND "total">=0 AND "subtotal">0 AND "custoEmbalagem">0)
);
CREATE UNIQUE INDEX "ItemCompra_compraId_produtoId_key" ON "ItemCompra"("compraId","produtoId");
