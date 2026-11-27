ALTER TABLE "Fornecedor" ADD COLUMN "codigoFornecedor" SERIAL, ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "contatoComercial" TEXT, ADD COLUMN "cep" TEXT, ADD COLUMN "cidade" TEXT, ADD COLUMN "uf" TEXT, ADD COLUMN "segmento" TEXT, ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "Fornecedor_codigoFornecedor_key" ON "Fornecedor"("codigoFornecedor");
CREATE INDEX "Fornecedor_empresaId_ativo_idx" ON "Fornecedor"("empresaId","ativo");
-- Preserve ambiguous legacy documents for manual review.
WITH docs AS (SELECT id,"empresaId",upper(regexp_replace(cnpj,'[./[:space:]-]','','g')) AS doc FROM "Fornecedor"), unicos AS (SELECT "empresaId",doc FROM docs GROUP BY "empresaId",doc HAVING count(*)=1)
UPDATE "Fornecedor" f SET cnpj=d.doc FROM docs d JOIN unicos u ON u."empresaId"=d."empresaId" AND u.doc=d.doc WHERE f.id=d.id AND d.doc<>'';
