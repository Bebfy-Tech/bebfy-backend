CREATE TYPE "FormaBaixaFinanceira" AS ENUM ('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','TRANSFERENCIA','OUTROS','NAO_INFORMADO');
ALTER TABLE "ContaPagar" ADD COLUMN "fornecedorId" TEXT, ADD COLUMN "valorBaixado" DECIMAL(65,30) NOT NULL DEFAULT 0, ADD COLUMN "observacao" TEXT, ADD COLUMN "grupoLancamento" TEXT, ADD COLUMN "parcela" INTEGER, ADD COLUMN "totalParcelas" INTEGER, ADD COLUMN "chaveLancamento" TEXT;
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ContaPagar_chaveLancamento_key" ON "ContaPagar"("chaveLancamento");
CREATE INDEX "ContaPagar_empresaId_status_dataVencimento_idx" ON "ContaPagar"("empresaId","status","dataVencimento");
UPDATE "ContaPagar" SET "valorBaixado"="valor" WHERE "status"='PAGO';
ALTER TABLE "ContaReceber" ADD COLUMN "clienteId" TEXT, ADD COLUMN "valorBaixado" DECIMAL(65,30) NOT NULL DEFAULT 0, ADD COLUMN "observacao" TEXT, ADD COLUMN "grupoLancamento" TEXT, ADD COLUMN "parcela" INTEGER, ADD COLUMN "totalParcelas" INTEGER, ADD COLUMN "chaveLancamento" TEXT;
ALTER TABLE "ContaReceber" ADD CONSTRAINT "ContaReceber_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ContaReceber_chaveLancamento_key" ON "ContaReceber"("chaveLancamento");
CREATE INDEX "ContaReceber_empresaId_status_dataVencimento_idx" ON "ContaReceber"("empresaId","status","dataVencimento");
UPDATE "ContaReceber" SET "valorBaixado"="valor" WHERE "status"='PAGO';
ALTER TABLE "ContaReceber" ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'OUTROS';
UPDATE "ContaPagar" c SET "fornecedorId"=n."fornecedorId" FROM "NotaFiscal" n WHERE c."notaFiscalId"=n.id AND c."empresaId"=n."empresaId";
CREATE TABLE "BaixaFinanceira" (
 "id" TEXT NOT NULL, "contaPagarId" TEXT, "contaReceberId" TEXT, "principal" DECIMAL(65,30) NOT NULL, "juros" DECIMAL(65,30) NOT NULL DEFAULT 0, "multa" DECIMAL(65,30) NOT NULL DEFAULT 0, "desconto" DECIMAL(65,30) NOT NULL DEFAULT 0, "forma" "FormaBaixaFinanceira" NOT NULL, "operadorId" TEXT, "observacao" TEXT, "estornoDeId" TEXT, "chaveOperacao" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BaixaFinanceira_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BaixaFinanceira_contaPagarId_fkey" FOREIGN KEY ("contaPagarId") REFERENCES "ContaPagar"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BaixaFinanceira_contaReceberId_fkey" FOREIGN KEY ("contaReceberId") REFERENCES "ContaReceber"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BaixaFinanceira_conta_exclusiva" CHECK (("contaPagarId" IS NULL) <> ("contaReceberId" IS NULL))
);
CREATE UNIQUE INDEX "BaixaFinanceira_estornoDeId_key" ON "BaixaFinanceira"("estornoDeId");
CREATE UNIQUE INDEX "BaixaFinanceira_chaveOperacao_key" ON "BaixaFinanceira"("chaveOperacao");
CREATE INDEX "BaixaFinanceira_contaPagarId_criadoEm_idx" ON "BaixaFinanceira"("contaPagarId","criadoEm");
CREATE INDEX "BaixaFinanceira_contaReceberId_criadoEm_idx" ON "BaixaFinanceira"("contaReceberId","criadoEm");
