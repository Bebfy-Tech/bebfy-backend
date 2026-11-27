-- Snapshot e contagem auditável dos lotes existentes no início do inventário.
ALTER TABLE "ItemInventarioEstoque" ADD COLUMN "lotesConferencia" JSONB;
