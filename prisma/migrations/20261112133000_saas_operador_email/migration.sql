ALTER TABLE "saas_operadores" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "saas_operadores_email_key" ON "saas_operadores"("email");
