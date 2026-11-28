import {describe,it,expect,vi} from 'vitest';
import {SaasService} from './saas.service';
import type {PrismaService} from '../core/prisma/prisma.service';
describe('SaaS: gestão de módulos',()=>{
 it('retorna acesso efetivo respeitando bloqueio manual e catálogo implementado',async()=>{
  const db={empresa:{findMany:vi.fn().mockResolvedValue([{id:1,nomeFantasia:'Teste',slug:'teste',status:'ATIVA',planoId:1,plano:{id:1,nome:'Pro',modulosPadrao:['FIADOS','PEDIDOS_ATACADO']},modulosAtivos:[{modulo:'FIADOS',ativo:false},{modulo:'PEDIDOS_ATACADO',ativo:true}]}])}} as unknown as PrismaService;
  const [empresa]=await new SaasService(db).listarVisaoModulos();
  expect(empresa.efetivos.FIADOS).toBe(false);expect(empresa.efetivos.PEDIDOS_ATACADO).toBe(false);
 });
 it('remove a exceção e volta a herdar o plano',async()=>{
  const tx={empresa:{findUnique:vi.fn().mockResolvedValue({id:1}),findUniqueOrThrow:vi.fn().mockResolvedValue({plano:{modulosPadrao:['FIADOS']},modulosAtivos:[]})},empresaModulo:{deleteMany:vi.fn().mockResolvedValue({count:1})}};
  const db={$transaction:vi.fn().mockImplementation(async callback=>callback(tx))} as unknown as PrismaService;
  const service=new SaasService(db);
  await expect(service.restaurarModuloEmpresa(1,'FIADOS')).resolves.toEqual({modulo:'FIADOS',ativo:true});
  expect(tx.empresaModulo.deleteMany).toHaveBeenCalledWith({where:{empresaId:1,modulo:'FIADOS'}});
  await expect(service.restaurarModuloEmpresa(1,'INVALIDO')).rejects.toThrow();
 });
});
