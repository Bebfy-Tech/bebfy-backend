-- Additive financial ledger: no destructive changes to legacy charges.
CREATE TABLE "saas_pagamentos" (
  "id" TEXT NOT NULL,
  "cobrancaId" TEXT NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "pagoEm" TIMESTAMP(3) NOT NULL,
  "forma" TEXT NOT NULL,
  "observacao" TEXT,
  "operadorId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_pagamentos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_pagamentos_cobrancaId_criadoEm_idx" ON "saas_pagamentos"("cobrancaId","criadoEm");
ALTER TABLE "saas_pagamentos" ADD CONSTRAINT "saas_pagamentos_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "saas_cobrancas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "saas_financeiro_eventos" (
  "id" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "operadorId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_financeiro_eventos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saas_financeiro_eventos_empresaId_criadoEm_idx" ON "saas_financeiro_eventos"("empresaId","criadoEm");
ALTER TABLE "saas_financeiro_eventos" ADD CONSTRAINT "saas_financeiro_eventos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
