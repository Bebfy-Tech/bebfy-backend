-- Temporary, scoped support diagnostics. No universal password or tenant impersonation.
CREATE TABLE "sessoes_suporte" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "administradorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "ticket" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "revogadoEm" TIMESTAMP(3),
  CONSTRAINT "sessoes_suporte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sessoes_suporte_administradorId_expiraEm_idx"
  ON "sessoes_suporte"("administradorId", "expiraEm");
CREATE INDEX "sessoes_suporte_empresaId_criadoEm_idx"
  ON "sessoes_suporte"("empresaId", "criadoEm");
ALTER TABLE "sessoes_suporte" ADD CONSTRAINT "sessoes_suporte_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
