-- Existing users retain their password and may authenticate once to establish a tracked session.
ALTER TABLE "Usuario"
  ADD COLUMN "primeiroAcesso" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sessaoId" TEXT,
  ADD COLUMN "ultimaAtividadeEm" TIMESTAMP(3);
CREATE INDEX "Usuario_sessaoId_idx" ON "Usuario"("sessaoId");
