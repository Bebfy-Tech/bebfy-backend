-- Add plan default modules without removing any existing assignments.
ALTER TABLE "planos" ADD COLUMN "modulosPadrao" "NomeModulo"[] NOT NULL DEFAULT ARRAY[]::"NomeModulo"[];
