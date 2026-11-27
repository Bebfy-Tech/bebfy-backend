ALTER TABLE "RecebimentoCompra" ADD COLUMN "estornadoEm" TIMESTAMP(3), ADD COLUMN "estornadoPor" TEXT, ADD COLUMN "motivoEstorno" TEXT;
ALTER TABLE "ItemRecebimentoCompra" ADD COLUMN "produtoAtualizadoEm" TIMESTAMP(3);
ALTER TABLE "RecebimentoCompra" ADD CONSTRAINT "recebimento_estorno_completo" CHECK (("estornadoEm" IS NULL AND "estornadoPor" IS NULL AND "motivoEstorno" IS NULL) OR ("estornadoEm" IS NOT NULL AND "estornadoPor" IS NOT NULL AND "motivoEstorno" IS NOT NULL));
