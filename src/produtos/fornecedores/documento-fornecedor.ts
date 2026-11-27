import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, TipoPessoa } from '@prisma/client';
import { normalizarDocumento, validarDocumento } from '../../varejo/clientes/documento';
export function documentoFornecedor(valor:string,tipo:TipoPessoa){
 const doc=validarDocumento(valor);
 if(!doc||tipo==='FISICA'&&doc.length!==11||tipo==='JURIDICA'&&doc.length!==14)throw new BadRequestException('Documento incompatível com o tipo de pessoa.');
 return doc;
}
// Parameterized lookup, including legacy formatted documents; never merge duplicates.
export async function buscarFornecedorDocumento(tx:Prisma.TransactionClient,empresaId:number,valor:string){
 const doc=normalizarDocumento(valor);
 const ids=await tx.$queryRaw<{id:string}[]>`SELECT id FROM "Fornecedor" WHERE "empresaId"=${empresaId} AND upper(regexp_replace(cnpj,'[./[:space:]-]','','g'))=${doc} LIMIT 2`;
 if(ids.length>1)throw new ConflictException('Há fornecedores antigos com o mesmo documento. Revise os cadastros antes de prosseguir.');
 return ids.length?tx.fornecedor.findFirst({where:{id:ids[0].id,empresaId}}):null;
}
