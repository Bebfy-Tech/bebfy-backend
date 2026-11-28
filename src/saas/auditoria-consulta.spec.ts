import {describe,it,expect,vi} from 'vitest';
import {consultaAuditoria} from './auditoria-consulta';
import {SaasAuditInterceptor} from './saas-audit.interceptor';
import {SaasService} from './saas.service';
import {lastValueFrom,of,throwError} from 'rxjs';
import type {PrismaService} from '../core/prisma/prisma.service';
import type {ExecutionContext} from '@nestjs/common';
describe('Auditoria administrativa',()=>{
 it('valida período, operador e paginação com ordem determinística',()=>{
  const q=consultaAuditoria({inicio:'2026-11-01T03:00:00.000Z',fim:'2026-12-01T03:00:00.000Z',metodo:'PATCH',pagina:'2',limite:'50'});
  expect(q.where).toMatchObject({metodo:'PATCH',criadoEm:{gte:new Date('2026-11-01T03:00:00.000Z'),lt:new Date('2026-12-01T03:00:00.000Z')}});
  expect(q.pagina).toBe(2);expect(q.limite).toBe(50);
  expect(q.orderBy).toEqual([{criadoEm:'desc'},{id:'desc'}]);
  expect(()=>consultaAuditoria({limite:'1000'})).toThrow();
  expect(()=>consultaAuditoria({inicio:'2026-12-01T00:00:00.000Z',fim:'2026-11-01T00:00:00.000Z'})).toThrow();
 });
 it('contabiliza histórico completo e limita a página, não o total',async()=>{
  const model={count:vi.fn().mockResolvedValue(1501),findMany:vi.fn().mockResolvedValue([{id:'e',operadorId:'a'}]),groupBy:vi.fn().mockResolvedValueOnce([{metodo:'POST',_count:{_all:1501}}]).mockResolvedValueOnce([{operadorId:'a',_count:{_all:1501}}])};
  const tx={saasAuditoria:model,saasOperador:{findMany:vi.fn().mockResolvedValue([{id:'a',nome:'QA',codigo:3}])}};
  const db={$transaction:vi.fn().mockImplementation(async cb=>cb(tx))} as unknown as PrismaService;
  const result=await new SaasService(db).listarAuditoriaPaginada({pagina:'999',limite:'20'});
  expect(result).toMatchObject({total:1501,pagina:76,limite:20,resumo:{operadores:1,porMetodo:{POST:1501}}});
  expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:1500,take:20}));
 });
 it('registra apenas metadados de operações bem sucedidas',async()=>{
  const create=vi.fn().mockResolvedValue({});
  const db={saasAuditoria:{create}} as unknown as PrismaService;
  const interceptor=new SaasAuditInterceptor(db);
  const req={method:'POST',originalUrl:'/saas/admin/funcionarios?token=secreto',body:{nome:'Valor privado',senha:'secreto',token:'secreto'},params:{},saasUser:{id:'a'}};
  const ctx={switchToHttp:()=>({getRequest:()=>req})} as unknown as ExecutionContext;
  await lastValueFrom(interceptor.intercept(ctx,{handle:()=>of({id:123,senha:'segredo'})}));
  expect(create).toHaveBeenCalledWith({data:{operadorId:'a',metodo:'POST',rota:'/saas/admin/funcionarios',campos:['nome'],recursoId:'123'}});
  await expect(lastValueFrom(interceptor.intercept(ctx,{handle:()=>throwError(()=>new Error('erro'))}))).rejects.toThrow('erro');
  expect(create).toHaveBeenCalledTimes(1);
 });
});
