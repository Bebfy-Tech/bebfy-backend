import {describe,it,expect} from 'vitest';
import {Prisma} from '@prisma/client';
import {calcularCmv} from './dre-cmv';
const d=(v:number)=>new Prisma.Decimal(v);
describe('CMV histórico e legado',()=>{
 it('utiliza unidades físicas e ignora preço de custo posterior',()=>{
  const r=calcularCmv([{unidadesEstoque:24,quantidade:2,custoHistorico:{custoUnitario:d(3.5)},produto:{precoCusto:d(8)}}]);
  expect(r.historico.toString()).toBe('84');expect(r.estimado.toString()).toBe('0');
 });
 it('separa registros antigos e sinaliza custo ausente',()=>{
  const r=calcularCmv([{unidadesEstoque:null,quantidade:3,custoHistorico:null,produto:{precoCusto:d(2)}},{unidadesEstoque:1,quantidade:1,custoHistorico:{custoUnitario:d(0)},produto:{precoCusto:d(5)}}]);
  expect(r.estimado.toString()).toBe('6');expect(r.historico.toString()).toBe('0');expect(r.legados).toBe(1);expect(r.semCusto).toBe(1);expect(r.semUnidades).toBe(1);
 });
});
