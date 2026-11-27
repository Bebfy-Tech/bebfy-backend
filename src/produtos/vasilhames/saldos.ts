import { BadRequestException } from '@nestjs/common';
import { OrigemCasco, Prisma } from '@prisma/client';

export function saldoLegado(total:number,tipos:number[]){const legado=total-tipos.reduce((a,b)=>a+b,0);if(legado<0||tipos.some(v=>v<0))throw new BadRequestException('Saldo de vasilhames inconsistente. Solicite conferência ao gestor.');return legado;}

/** Caller holds the customer's row lock in the same transaction. */
export async function aplicarCasco(tx:Prisma.TransactionClient,empresaId:number,clienteId:string,m:{tipoVasilhameId:number|null;quantidade:number;origem:OrigemCasco;produtoId?:number|null;vendaId?:string;observacao?:string;chaveOperacao?:string}){
 if(!Number.isSafeInteger(m.quantidade)||!m.quantidade||Math.abs(m.quantidade)>2147483647)throw new BadRequestException('Quantidade inválida.');
 const c=await tx.cliente.findFirst({where:{id:clienteId,empresaId},select:{cascosEmPosse:true,ativo:true}});
 if(!c||(!c.ativo&&m.origem!=='ESTORNO'))throw new BadRequestException('Cliente indisponível.');
 const grupos=await tx.movimentacaoCasco.groupBy({by:['tipoVasilhameId'],where:{empresaId,clienteId,tipoVasilhameId:{not:null}},_sum:{quantidade:true}});
 const legado=saldoLegado(c.cascosEmPosse,grupos.map(g=>g._sum.quantidade??0));
 const atual=m.tipoVasilhameId===null?legado:grupos.find(g=>g.tipoVasilhameId===m.tipoVasilhameId)?._sum.quantidade??0;
 if(m.origem==='CLASSIFICACAO'){if(m.tipoVasilhameId===null||m.quantidade<=0||m.quantidade>legado)throw new BadRequestException('Quantidade superior ao saldo não classificado.');}
 else if(atual+m.quantidade<0)throw new BadRequestException('Quantidade superior ao saldo deste tipo de vasilhame.');
 const variacao=m.origem==='CLASSIFICACAO'?0:m.quantidade;
 if(c.cascosEmPosse+variacao>2147483647||c.cascosEmPosse+variacao<0)throw new BadRequestException('Saldo de vasilhames inválido.');
 if(variacao)await tx.cliente.updateMany({where:{id:clienteId,empresaId},data:{cascosEmPosse:{increment:variacao}}});
 return tx.movimentacaoCasco.create({data:{empresaId,clienteId,...m},include:{tipoVasilhame:{select:{id:true,nome:true}},produto:{select:{id:true,nome:true}}}});
}
