CREATE TYPE "SaasCargo" AS ENUM ('SUPER_ADMIN', 'OPERADOR');
CREATE TABLE "saas_operadores" (
  "id" TEXT NOT NULL,
  "codigo" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "senha" TEXT NOT NULL,
  "cargo" "SaasCargo" NOT NULL DEFAULT 'OPERADOR',
  "permissoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "sessaoId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_operadores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saas_operadores_codigo_key" ON "saas_operadores"("codigo");