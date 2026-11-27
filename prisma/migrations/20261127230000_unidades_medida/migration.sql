CREATE TYPE "TipoUnidadeMedida" AS ENUM ('CONTAGEM','EMBALAGEM','PESO','VOLUME','OUTROS');
ALTER TABLE "empresas" ADD COLUMN "unidadesInicializadas" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "UnidadeMedida" ("id" TEXT NOT NULL,"empresaId" INTEGER NOT NULL,"sigla" TEXT NOT NULL,"descricao" TEXT NOT NULL,"tipo" "TipoUnidadeMedida" NOT NULL,"ativo" BOOLEAN NOT NULL DEFAULT true,"criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "UnidadeMedida_pkey" PRIMARY KEY ("id"),CONSTRAINT "UnidadeMedida_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE,CONSTRAINT "UnidadeMedida_sigla_check" CHECK ("sigla" ~ '^[A-Z0-9]{1,6}$'));
CREATE UNIQUE INDEX "UnidadeMedida_empresaId_sigla_key" ON "UnidadeMedida"("empresaId","sigla");
CREATE INDEX "UnidadeMedida_empresaId_ativo_idx" ON "UnidadeMedida"("empresaId","ativo");
ALTER TABLE "Produto" ADD COLUMN "unidadeMedidaId" TEXT, ADD COLUMN "unidadeEmbalagemId" TEXT, ADD COLUMN "unidadeEmbalagemSigla" TEXT;
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_unidadeMedidaId_fkey" FOREIGN KEY ("unidadeMedidaId") REFERENCES "UnidadeMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD CONSTRAINT "Produto_unidadeEmbalagemId_fkey" FOREIGN KEY ("unidadeEmbalagemId") REFERENCES "UnidadeMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Produto_unidadeMedidaId_idx" ON "Produto"("unidadeMedidaId");
CREATE INDEX "Produto_unidadeEmbalagemId_idx" ON "Produto"("unidadeEmbalagemId");
INSERT INTO "UnidadeMedida" ("id","empresaId","sigla","descricao","tipo") SELECT md5('unidade:'||e.id||':'||v.sigla),e.id,v.sigla,v.descricao,v.tipo::"TipoUnidadeMedida" FROM "empresas" e CROSS JOIN (VALUES ('UN','Unidade','CONTAGEM'),('CX','Caixa','EMBALAGEM'),('FD','Fardo','EMBALAGEM'),('PCT','Pacote','EMBALAGEM'),('ENG','Engradado','EMBALAGEM'),('KG','Quilograma','PESO'),('LT','Litro','VOLUME'),('ML','Mililitro','VOLUME')) v(sigla,descricao,tipo);
-- Preserve legacy labels, including custom abbreviations. No stock conversion.
INSERT INTO "UnidadeMedida" ("id","empresaId","sigla","descricao","tipo") SELECT DISTINCT md5('unidade:'||p."empresaId"||':'||upper(trim(p."unidadeMedida"))),p."empresaId",upper(trim(p."unidadeMedida")),'Unidade anterior: '||upper(trim(p."unidadeMedida")),'OUTROS'::"TipoUnidadeMedida" FROM "Produto" p WHERE upper(trim(p."unidadeMedida")) ~ '^[A-Z0-9]{1,6}$' ON CONFLICT ("empresaId","sigla") DO NOTHING;
UPDATE "Produto" p SET "unidadeMedidaId"=u.id FROM "UnidadeMedida" u WHERE u."empresaId"=p."empresaId" AND u.sigla=upper(trim(p."unidadeMedida"));
-- Legacy packs already used the fardo multiplier; preserve their generic label.
UPDATE "Produto" p SET "unidadeEmbalagemId"=u.id,"unidadeEmbalagemSigla"='FD' FROM "UnidadeMedida" u WHERE u."empresaId"=p."empresaId" AND u.sigla='FD' AND p."fardoQuantidade">1;
UPDATE "empresas" SET "unidadesInicializadas"=true;
