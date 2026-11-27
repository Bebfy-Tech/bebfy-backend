-- Stable, globally unique customer reference; all queries remain tenant-scoped.
CREATE SEQUENCE "Cliente_codigoCliente_seq";
ALTER TABLE "Cliente" ADD COLUMN "codigoCliente" INTEGER;
WITH numerados AS (SELECT id, ROW_NUMBER() OVER (ORDER BY "criadoEm", id)::integer AS codigo FROM "Cliente")
UPDATE "Cliente" c SET "codigoCliente" = n.codigo FROM numerados n WHERE c.id = n.id;
SELECT setval('"Cliente_codigoCliente_seq"', COALESCE(MAX("codigoCliente"), 1), COUNT(*) > 0) FROM "Cliente";
ALTER TABLE "Cliente" ALTER COLUMN "codigoCliente" SET DEFAULT nextval('"Cliente_codigoCliente_seq"'), ALTER COLUMN "codigoCliente" SET NOT NULL;
ALTER SEQUENCE "Cliente_codigoCliente_seq" OWNED BY "Cliente"."codigoCliente";
CREATE UNIQUE INDEX "Cliente_codigoCliente_key" ON "Cliente"("codigoCliente");
CREATE TYPE "OrigemFiado" AS ENUM ('VENDA','RECEBIMENTO','ESTORNO','AJUSTE_MANUAL','LEGADO');
ALTER TABLE "HistoricoFiado" ADD COLUMN "origem" "OrigemFiado" NOT NULL DEFAULT 'LEGADO', ADD COLUMN "formaRecebimento" "FormaPagamento", ADD COLUMN "caixaRecebimentoId" TEXT, ADD COLUMN "chaveRecebimento" TEXT;
CREATE UNIQUE INDEX "HistoricoFiado_chaveRecebimento_key" ON "HistoricoFiado"("chaveRecebimento");
-- Only classify legacy rows whose original application-generated descriptions identify their origin.
UPDATE "HistoricoFiado" SET "origem"='VENDA' WHERE "tipo"='DEBITO' AND "vendaId" IS NOT NULL AND "descricao" LIKE 'Venda no PDV código #%';
UPDATE "HistoricoFiado" SET "origem"='ESTORNO' WHERE "tipo"='CREDITO' AND "vendaId" IS NOT NULL AND "descricao" LIKE 'Estorno/Cancelamento da venda código #%';
UPDATE "HistoricoFiado" SET "origem"='RECEBIMENTO', "formaRecebimento"=substring("descricao" from 'Forma: (DINHEIRO|PIX|CARTAO_DEBITO|CARTAO_CREDITO)$')::"FormaPagamento" WHERE "tipo"='CREDITO' AND "vendaId" IS NULL AND "descricao" IN ('Baixa de fiado no balcão - Forma: DINHEIRO','Baixa de fiado no balcão - Forma: PIX','Baixa de fiado no balcão - Forma: CARTAO_DEBITO','Baixa de fiado no balcão - Forma: CARTAO_CREDITO');
