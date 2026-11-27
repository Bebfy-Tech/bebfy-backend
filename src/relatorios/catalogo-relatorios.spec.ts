import {describe,it,expect} from 'vitest';
import {podeRelatorio,periodoRelatorio,reposicao,RELATORIOS} from './catalogo-relatorios';
describe('Central de relatórios',()=>{
 it('cada relatório tem código e permissão independentes',()=>{expect(new Set(RELATORIOS.map(r=>r.codigo)).size).toBe(RELATORIOS.length);expect(podeRelatorio('001',{cargo:'ESTOQUISTA',permissoes:['RELATORIO_001']})).toBe(true);expect(podeRelatorio('013',{cargo:'ESTOQUISTA',permissoes:['RELATORIO_001']})).toBe(false);});
 it('gestores acessam os relatórios liberados pelo plano',()=>expect(podeRelatorio('013',{cargo:'GERENTE'})).toBe(true));
 it('reposição não inventa demanda nem quantidade negativa',()=>{expect(reposicao(3,20).sugerida).toBe(17);expect(reposicao(0,0).sugerida).toBe(0);expect(reposicao(30,20).sugerida).toBe(0);});
 it('valida datas e usa limite exclusivo em Brasília',()=>{expect(()=>periodoRelatorio('2026-02-30','2026-03-01')).toThrow();expect(periodoRelatorio('2026-11-01','2026-11-01').lt.toISOString()).toBe('2026-11-02T03:00:00.000Z');});
});
