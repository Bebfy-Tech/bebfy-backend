CREATE TABLE "saas_cobrancas" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "referencia" TEXT NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "vencimento" TIMESTAMP(3) NOT NULL,
  "pagoEm" TIMESTAMP(3),
  "linhaDigitavel" TEXT,
  "observacao" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_cobrancas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_cobrancas_empresaId_vencimento_idx" ON "saas_cobrancas"("empresaId", "vencimento");
ALTER TABLE "saas_cobrancas" ADD CONSTRAINT "saas_cobrancas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
