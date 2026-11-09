ALTER TABLE "empresas" ADD COLUMN "inadimplente" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "empresas" ADD COLUMN "liberacaoFinanceiraAte" TIMESTAMP(3);
CREATE TABLE "saas_liberacoes_acesso" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "operadorId" TEXT NOT NULL,
  "dias" INTEGER NOT NULL,
  "motivo" TEXT NOT NULL,
  "liberadoAte" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_liberacoes_acesso_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_liberacoes_acesso_empresaId_criadoEm_idx" ON "saas_liberacoes_acesso"("empresaId", "criadoEm");
ALTER TABLE "saas_liberacoes_acesso" ADD CONSTRAINT "saas_liberacoes_acesso_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;