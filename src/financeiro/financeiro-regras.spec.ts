import { parcelasMensais } from './financeiro-regras';
describe('Parcelamento financeiro',()=>{
 it('preserva centavos e vencimentos no final do mês',()=>{const p=parcelasMensais(100,'2027-01-31','PARCELADA',3);expect(p.map(x=>x.valor)).toEqual([33.34,33.33,33.33]);expect(p.map(x=>x.dataVencimento.toISOString().slice(0,10))).toEqual(['2027-01-31','2027-02-28','2027-03-31']);});
 it('repete valor mensal e rejeita data inválida',()=>{expect(parcelasMensais(100,'2027-01-31','RECORRENTE',2).map(x=>x.valor)).toEqual([100,100]);expect(()=>parcelasMensais(1,'2027-02-30','UNICA',1)).toThrow();});
});
