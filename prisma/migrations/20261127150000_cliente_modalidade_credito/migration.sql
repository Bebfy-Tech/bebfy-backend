-- Preserve existing positive limits and the previous unlimited-zero behavior.
CREATE TYPE "ModalidadeCredito" AS ENUM ('BLOQUEADO', 'LIMITADO', 'ILIMITADO');
ALTER TABLE "Cliente" ADD COLUMN "modalidadeCredito" "ModalidadeCredito" NOT NULL DEFAULT 'BLOQUEADO';
UPDATE "Cliente" SET "modalidadeCredito" = CASE WHEN "limiteCredito" > 0 THEN 'LIMITADO'::"ModalidadeCredito" ELSE 'ILIMITADO'::"ModalidadeCredito" END;
-- The historic negative-value behavior was also unlimited; normalize it.
UPDATE "Cliente" SET "limiteCredito" = 0 WHERE "limiteCredito" < 0;
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_credito_consistente" CHECK (("modalidadeCredito" = 'LIMITADO' AND "limiteCredito" > 0) OR ("modalidadeCredito" <> 'LIMITADO' AND "limiteCredito" = 0));
