-- Private small attachments in PostgreSQL; uploaded by authorized SaaS operators only.
CREATE TABLE "saas_anexos_financeiros" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "cobrancaId" TEXT,
  "tipo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "conteudo" BYTEA NOT NULL,
  "tamanho" INTEGER NOT NULL,
  "operadorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_anexos_financeiros_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_anexos_financeiros_empresaId_criadoEm_idx" ON "saas_anexos_financeiros"("empresaId","criadoEm");
ALTER TABLE "saas_anexos_financeiros" ADD CONSTRAINT "saas_anexos_financeiros_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_anexos_financeiros" ADD CONSTRAINT "saas_anexos_financeiros_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "saas_cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
