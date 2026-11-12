CREATE TABLE "saas_chamado_anexos" (
  "id" TEXT NOT NULL,
  "chamadoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "conteudo" BYTEA NOT NULL,
  "operadorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_chamado_anexos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_chamado_anexos_chamadoId_criadoEm_idx" ON "saas_chamado_anexos"("chamadoId","criadoEm");
ALTER TABLE "saas_chamado_anexos" ADD CONSTRAINT "saas_chamado_anexos_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "saas_chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
