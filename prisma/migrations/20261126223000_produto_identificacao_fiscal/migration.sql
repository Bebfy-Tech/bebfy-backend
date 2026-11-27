-- Campos opcionais; preserva produtos e dados existentes.
ALTER TABLE "Produto"
  ADD COLUMN "marca" VARCHAR(120),
  ADD COLUMN "fabricante" VARCHAR(160),
  ADD COLUMN "descricaoComplementar" VARCHAR(2000),
  ADD COLUMN "grupo" VARCHAR(120),
  ADD COLUMN "subgrupo" VARCHAR(120),
  ADD COLUMN "ncm" VARCHAR(8),
  ADD COLUMN "cest" VARCHAR(7);
