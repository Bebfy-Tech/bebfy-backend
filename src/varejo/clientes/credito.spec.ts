import { configurarCredito, exigirCredito } from './credito';
import { ModalidadeCredito as M } from '@prisma/client';
describe('Política de crédito',()=>{
 it('não modifica a política em edições cadastrais',()=>expect(configurarCredito()).toEqual({}));
 it('exige limite positivo e mantém compatibilidade com limite anterior',()=>{
  expect(configurarCredito(undefined,500)).toEqual({modalidadeCredito:M.LIMITADO,limiteCredito:500});
  expect(configurarCredito(undefined,0)).toEqual({modalidadeCredito:M.BLOQUEADO,limiteCredito:0});
  expect(()=>configurarCredito(M.LIMITADO,0)).toThrow();
  expect(()=>configurarCredito(M.BLOQUEADO,500)).toThrow();
  expect(()=>configurarCredito(M.ILIMITADO,null)).toThrow();
 });
 it('bloqueia nova dívida mesmo sem saldo anterior',()=>expect(()=>exigirCredito({modalidadeCredito:M.BLOQUEADO,limiteCredito:0,saldoDevedor:0},1)).toThrow());
 it('aceita compras no limite e rejeita excesso inclusive centavos',()=>{
  const c={modalidadeCredito:M.LIMITADO,limiteCredito:500,saldoDevedor:185};
  expect(()=>exigirCredito(c,315)).not.toThrow();
  expect(()=>exigirCredito(c,315.01)).toThrow();
  expect(()=>exigirCredito({...c,limiteCredito:100},1)).toThrow();
 });
 it('aceita crédito ilimitado explicitamente',()=>expect(()=>exigirCredito({modalidadeCredito:M.ILIMITADO,limiteCredito:0,saldoDevedor:5000},1000)).not.toThrow());
});
