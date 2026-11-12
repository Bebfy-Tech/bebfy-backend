CREATE TABLE "saas_modulo_descricoes" (
  "modulo" "NomeModulo" NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saas_modulo_descricoes_pkey" PRIMARY KEY ("modulo")
);
