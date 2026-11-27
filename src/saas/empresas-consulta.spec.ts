import {describe,it,expect} from 'vitest';
import {consultaEmpresas} from './empresas-consulta';
describe('Consulta paginada de empresas',()=>{
 it('aplica filtros cumulativos e ordenação estável',()=>{const r=consultaEmpresas({status:'ATIVA',plano:'2',financeiro:'BLOQUEADO',busca:'123',pagina:'2',limite:'20'});expect(r.where.status).toBe('ATIVA');expect(r.where.planoId).toBe(2);expect(r.where.inadimplente).toBe(true);expect(r.where.AND).toBeDefined();expect(r.where.OR).toContainEqual({id:123});expect(r.pagina).toBe(2);expect(r.limite).toBe(20);});
 it('rejeita parâmetros inválidos e limites arbitrários',()=>{expect(()=>consultaEmpresas({pagina:'0'})).toThrow();expect(()=>consultaEmpresas({limite:'10000'})).toThrow();expect(()=>consultaEmpresas({status:'TESTE'})).toThrow();});
 it('permite filtrar plano ausente e cortesia vigente',()=>{const now=new Date('2026-11-27T12:00:00Z');const r=consultaEmpresas({plano:'SEM_PLANO',financeiro:'CORTESIA'},now);expect(r.where.planoId).toBeNull();expect(r.where.liberacaoFinanceiraAte).toEqual({gt:now});});
});
