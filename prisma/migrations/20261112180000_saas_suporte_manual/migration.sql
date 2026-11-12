-- Manual WhatsApp support, independent of external service providers.
CREATE TABLE "saas_chamados" (
  "id" TEXT NOT NULL,
  "numero" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "contatoNome" TEXT,
  "contatoTelefone" TEXT,
  "categoria" TEXT NOT NULL DEFAULT 'DUVIDA',
  "prioridade" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "comDev" BOOLEAN NOT NULL DEFAULT false,
  "responsavelId" TEXT,
  "devResponsavel" TEXT,
  "solucao" TEXT,
  "abertoPorId" TEXT NOT NULL,
  "resolvidoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_chamados_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saas_chamados_numero_key" ON "saas_chamados"("numero");
CREATE INDEX "saas_chamados_empresaId_criadoEm_idx" ON "saas_chamados"("empresaId", "criadoEm");
CREATE INDEX "saas_chamados_status_prioridade_atualizadoEm_idx" ON "saas_chamados"("status", "prioridade", "atualizadoEm");
ALTER TABLE "saas_chamados" ADD CONSTRAINT "saas_chamados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "saas_chamado_eventos" (
  "id" TEXT NOT NULL,
  "chamadoId" TEXT NOT NULL,
  "operadorId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_chamado_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_chamado_eventos_chamadoId_criadoEm_idx" ON "saas_chamado_eventos"("chamadoId","criadoEm");
ALTER TABLE "saas_chamado_eventos" ADD CONSTRAINT "saas_chamado_eventos_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "saas_chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
