CREATE TABLE "saas_configuracao_cobranca" (
  "empresaId" INTEGER NOT NULL,
  "recorrente" BOOLEAN NOT NULL DEFAULT false,
  "diaVencimento" INTEGER NOT NULL DEFAULT 15,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_configuracao_cobranca_pkey" PRIMARY KEY ("empresaId")
);
ALTER TABLE "saas_configuracao_cobranca" ADD CONSTRAINT "saas_configuracao_cobranca_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "saas_mensalidades_geradas" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "competencia" TEXT NOT NULL,
  "cobrancaId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_mensalidades_geradas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saas_mensalidades_geradas_empresaId_competencia_key" ON "saas_mensalidades_geradas"("empresaId","competencia");
CREATE UNIQUE INDEX "saas_mensalidades_geradas_cobrancaId_key" ON "saas_mensalidades_geradas"("cobrancaId");
ALTER TABLE "saas_mensalidades_geradas" ADD CONSTRAINT "saas_mensalidades_geradas_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_mensalidades_geradas" ADD CONSTRAINT "saas_mensalidades_geradas_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "saas_cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
