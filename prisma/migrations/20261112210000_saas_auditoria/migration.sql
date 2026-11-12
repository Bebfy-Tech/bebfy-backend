CREATE TABLE "saas_auditoria" (
  "id" TEXT NOT NULL,
  "operadorId" TEXT NOT NULL,
  "metodo" TEXT NOT NULL,
  "rota" TEXT NOT NULL,
  "campos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recursoId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_auditoria_criadoEm_idx" ON "saas_auditoria"("criadoEm");
CREATE INDEX "saas_auditoria_operadorId_criadoEm_idx" ON "saas_auditoria"("operadorId","criadoEm");
