CREATE TYPE "TipoCadastroFinanceiro" AS ENUM ('FORMA_PAGAMENTO','CUSTO_FIXO','CUSTO_VARIAVEL','RECEITA','BANCO','CONTA','OPERADORA');
ALTER TABLE "empresas" ADD COLUMN "cadastrosFinanceirosInicializados" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "CadastroFinanceiro" (
 "id" TEXT NOT NULL, "empresaId" INTEGER NOT NULL, "tipo" "TipoCadastroFinanceiro" NOT NULL, "nome" TEXT NOT NULL, "nomeNormalizado" TEXT NOT NULL,
 "ativo" BOOLEAN NOT NULL DEFAULT true, "formaBase" "FormaBaixaFinanceira", "fiado" BOOLEAN NOT NULL DEFAULT false,
 "permitePagar" BOOLEAN NOT NULL DEFAULT false, "permiteReceber" BOOLEAN NOT NULL DEFAULT false, "permitePdv" BOOLEAN NOT NULL DEFAULT false,
 "maxParcelas" INTEGER NOT NULL DEFAULT 1, "taxas" JSONB, "bancoId" TEXT, "contaId" TEXT, "operadoraId" TEXT,
 "agencia" TEXT, "numeroConta" TEXT, "tipoConta" TEXT, "chavePix" TEXT, "saldoInicial" DECIMAL(65,30) NOT NULL DEFAULT 0,
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "CadastroFinanceiro_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CadastroFinanceiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "CadastroFinanceiro_bancoId_fkey" FOREIGN KEY ("bancoId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CadastroFinanceiro_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CadastroFinanceiro_operadoraId_fkey" FOREIGN KEY ("operadoraId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CadastroFinanceiro_empresaId_tipo_nomeNormalizado_key" ON "CadastroFinanceiro"("empresaId","tipo","nomeNormalizado");
CREATE INDEX "CadastroFinanceiro_empresaId_tipo_ativo_idx" ON "CadastroFinanceiro"("empresaId","tipo","ativo");
CREATE TABLE "AuditoriaCadastroFinanceiro" ("id" TEXT NOT NULL,"empresaId" INTEGER NOT NULL,"cadastroId" TEXT NOT NULL,"operadorId" TEXT,"acao" TEXT NOT NULL,"antes" JSONB,"depois" JSONB,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "AuditoriaCadastroFinanceiro_pkey" PRIMARY KEY ("id"),CONSTRAINT "AuditoriaCadastroFinanceiro_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "AuditoriaCadastroFinanceiro_empresaId_criadoEm_idx" ON "AuditoriaCadastroFinanceiro"("empresaId","criadoEm");
ALTER TABLE "ContaPagar" ADD COLUMN "categoriaCadastroId" TEXT;
ALTER TABLE "ContaReceber" ADD COLUMN "categoriaCadastroId" TEXT;
ALTER TABLE "BaixaFinanceira" ADD COLUMN "formaCadastroId" TEXT,ADD COLUMN "contaFinanceiraId" TEXT,ADD COLUMN "formaNome" TEXT,ADD COLUMN "contaFinanceiraNome" TEXT;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_categoriaCadastroId_fkey" FOREIGN KEY ("categoriaCadastroId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_categoriaCadastroId_fkey" FOREIGN KEY ("categoriaCadastroId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaixaFinanceira" ADD CONSTRAINT "BaixaFinanceira_formaCadastroId_fkey" FOREIGN KEY ("formaCadastroId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BaixaFinanceira" ADD CONSTRAINT "BaixaFinanceira_contaFinanceiraId_fkey" FOREIGN KEY ("contaFinanceiraId") REFERENCES "CadastroFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
