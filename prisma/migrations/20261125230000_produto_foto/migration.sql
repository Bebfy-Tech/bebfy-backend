CREATE TABLE "ProdutoFoto" (
  "produtoId" INTEGER NOT NULL,
  "jpeg" BYTEA NOT NULL,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProdutoFoto_pkey" PRIMARY KEY ("produtoId"),
  CONSTRAINT "ProdutoFoto_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
