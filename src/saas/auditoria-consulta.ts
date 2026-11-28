import {BadRequestException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
const iso=z.string().datetime().max(30);
const schema=z.object({
 busca:z.string().trim().max(120).default(''),
 operador:z.string().uuid().optional(),
 metodo:z.enum(['TODOS','POST','PATCH','PUT','DELETE']).default('TODOS'),
 inicio:iso.optional(),fim:iso.optional(),
 pagina:z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(1000000)).default(1),
 limite:z.enum(['10','20','50','100']).default('20').transform(Number),
 ordem:z.enum(['RECENTES','ANTIGOS']).default('RECENTES'),
}).strict();
export function consultaAuditoria(query:unknown){
 const parsed=schema.safeParse(query);
 if(!parsed.success)throw new BadRequestException('Filtros de auditoria inválidos.');
 const q=parsed.data,where:Prisma.SaasAuditoriaWhereInput={};
 const inicio=q.inicio?new Date(q.inicio):undefined,fim=q.fim?new Date(q.fim):undefined;
 if(inicio&&fim&&inicio>=fim)throw new BadRequestException('O fim do período deve ser posterior ao início.');
 if(inicio||fim)where.criadoEm={...(inicio?{gte:inicio}:{}),...(fim?{lt:fim}:{})};
 if(q.operador)where.operadorId=q.operador;
 if(q.metodo!=='TODOS')where.metodo=q.metodo;
 if(q.busca){
   const contains={contains:q.busca,mode:'insensitive' as const};
   where.OR=[{rota:contains},{recursoId:contains},{operadorId:contains},{metodo:contains},{id:contains},{campos:{has:q.busca}}];
 }
 const dir=q.ordem==='RECENTES'?'desc':'asc';
 const orderBy:Prisma.SaasAuditoriaOrderByWithRelationInput[]=[{criadoEm:dir},{id:dir}];
 return {where,orderBy,pagina:q.pagina,limite:q.limite};
}
