-- Quantidade física efetivamente baixada na operação.
-- Linhas antigas permanecem NULL: não é possível inferir com segurança
-- o multiplicador histórico de fardos apenas a partir dos dados existentes.
ALTER TABLE "ItemVenda" ADD COLUMN "unidadesEstoque" INTEGER;
