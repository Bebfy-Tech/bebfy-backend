import {describe,it,expect,vi} from 'vitest';
import {SaasService} from './saas.service';
import type {PrismaService} from '../core/prisma/prisma.service';
describe('SaaS monitoramento operacional',()=>{
 it('separa atividade histórica de contas habilitadas e vendas concluídas por empresa',async()=>{
   const agora=new Date();
   const tx={empresa:{findMany:vi.fn().mockResolvedValue([{id:1},{id:2}])},
    usuario:{findMany:vi.fn().mockResolvedValue([
      {ativo:true,ultimaAtividadeEm:agora,funcionario:{empresaId:1,ativo:true}},
      {ativo:true,ultimaAtividadeEm:agora,funcionario:{empresaId:1,ativo:false}},
      {ativo:false,ultimaAtividadeEm:null,funcionario:{empresaId:2,ativo:true}},
    ])},
    venda:{groupBy:vi.fn().mockResolvedValue([{empresaId:1,_count:{_all:3}}])}};
   const prisma={$transaction:vi.fn().mockImplementation(async callback=>callback(tx))} as unknown as PrismaService;
   const rows=await new SaasService(prisma).listarMonitoramento();
   expect(rows[0]).toMatchObject({usuariosAtivos:1,usuariosRecentes:2,ultimoAcesso:agora,vendasConcluidas7d:3});
   expect(rows[1]).toMatchObject({usuariosAtivos:0,usuariosRecentes:0,ultimoAcesso:null,vendasConcluidas7d:0});
   expect(tx.venda.groupBy).toHaveBeenCalledWith(expect.objectContaining({by:['empresaId'],where:expect.objectContaining({status:'CONCLUIDA'})}));
 });
});
