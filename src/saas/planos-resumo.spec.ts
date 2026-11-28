import { describe, expect, it, vi } from 'vitest';
import { SaasService } from './saas.service';
import type { PrismaService } from '../core/prisma/prisma.service';
describe('SaaS — resumo de planos',()=>{
 it('agrega empresas por plano e status sem expor dados dos clientes',async()=>{
  const tx={plano:{findMany:vi.fn().mockResolvedValue([{id:1,nome:'Pro',precoMensal:149.9},{id:2,nome:'Basic',precoMensal:99.9}])},empresa:{groupBy:vi.fn().mockResolvedValue([{planoId:1,status:'ATIVA',_count:{_all:4}},{planoId:1,status:'EM_TESTE',_count:{_all:2}},{planoId:1,status:'CANCELADA',_count:{_all:1}}])}};
  const db={$transaction:vi.fn().mockImplementation(async callback=>callback(tx))} as unknown as PrismaService;
  const result=await new SaasService(db).listarPlanos();
  expect(result[0].resumo).toEqual({total:7,ativas:4,emTeste:2,suspensas:0,canceladas:1});
  expect(result[1].resumo).toEqual({total:0,ativas:0,emTeste:0,suspensas:0,canceladas:0});
  expect(tx.empresa.groupBy).toHaveBeenCalledWith({by:['planoId','status'],where:{planoId:{not:null}},_count:{_all:true}});
 });
});
