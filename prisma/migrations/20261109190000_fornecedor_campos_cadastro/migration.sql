-- Align suppliers with the create/update DTO and frontend cadastro.
ALTER TABLE "Fornecedor"
  ADD COLUMN "inscricaoEstadual" TEXT,
  ADD COLUMN "endereco" TEXT;
