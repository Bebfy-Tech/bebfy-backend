CREATE TABLE "reset_senha_tokens" (
  "id" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "usadoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reset_senha_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reset_senha_tokens_tokenHash_key" ON "reset_senha_tokens"("tokenHash");
CREATE INDEX "reset_senha_tokens_usuarioId_expiraEm_idx" ON "reset_senha_tokens"("usuarioId","expiraEm");
ALTER TABLE "reset_senha_tokens" ADD CONSTRAINT "reset_senha_tokens_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reset_senha_tokens" ADD CONSTRAINT "reset_senha_tokens_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
