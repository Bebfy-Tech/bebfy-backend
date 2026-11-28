import { BadRequestException } from '@nestjs/common';
import { Prisma, StatusEmpresa } from '@prisma/client';
import { z } from 'zod';
const inteiro=(max:number)=>z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(max));
const schema=z.object({
 busca:z.string().trim().max(120).default(''),
 status:z.enum(['TODAS','ATIVA','EM_TESTE','SUSPENSA','CANCELADA']).default('TODAS'),
 plano: z.union([z.literal('TODOS'),z.literal('SEM_PLANO'),inteiro(2147483647)]).default('TODOS'),
 financeiro:z.enum(['TODOS','REGULAR','INADIMPLENTE','CORTESIA','BLOQUEADO']).default('TODOS'),
 pagina:inteiro(100000).default(1),
 limite:z.enum(['10','20','50']).default('10').transform(Number),
 ordem:z.enum(['RECENTES','NOME','ANTIGOS']).default('RECENTES'),
}).strict();
export function consultaEmpresas(query:unknown,now=new Date()){
 const r=schema.safeParse(query);if(!r.success)throw new BadRequestException('Filtros de distribuidoras inválidos.');
 const q=r.data,where:Prisma.EmpresaWhereInput={};
 if(q.status!=='TODAS')where.status=q.status as StatusEmpresa;
 if(q.plano!=='TODOS')where.planoId=q.plano==='SEM_PLANO'?null:q.plano;
 if(q.financeiro==='REGULAR')where.inadimplente=false;
 if(q.financeiro==='INADIMPLENTE')where.inadimplente=true;
 if(q.financeiro==='CORTESIA'){where.inadimplente=true;where.liberacaoFinanceiraAte={gt:now};}
 if(q.financeiro==='BLOQUEADO'){where.inadimplente=true;where.AND=[{OR:[{liberacaoFinanceiraAte:null},{liberacaoFinanceiraAte:{lte:now}}]}];}
 if(q.busca){
  const doc=q.busca.replace(/[.\s/-]/g,'');
  const contains={contains:q.busca,mode:'insensitive' as const};
  where.OR=[{nomeFantasia:contains},{razaoSocial:contains},{slug:contains},{subdominio:contains},{cnpj:contains},{funcionarios:{some:{cargo:'PROPRIETARIO',nome:contains}}}];
  if(doc!==q.busca&&doc)where.OR.push({cnpj:{contains:doc,mode:'insensitive'}});
  if(/^\d{1,9}$/.test(q.busca))where.OR.push({id:Number(q.busca)});
 }
 const orderBy:Prisma.EmpresaOrderByWithRelationInput[]=q.ordem==='NOME'?[{nomeFantasia:'asc'},{id:'asc'}]:[{criadoEm:q.ordem==='RECENTES'?'desc':'asc'},{id:q.ordem==='RECENTES'?'desc':'asc'}];
 return {where,orderBy,pagina:q.pagina,limite:q.limite};
}
