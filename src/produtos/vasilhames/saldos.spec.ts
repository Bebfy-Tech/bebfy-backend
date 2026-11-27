import { saldoLegado } from './saldos';
describe('Saldo de vasilhames legado',()=>{
 it('não inventa composição',()=>expect(saldoLegado(48,[])).toBe(48));
 it('separa tipos do saldo antigo',()=>expect(saldoLegado(48,[24,12])).toBe(12));
 it('rejeita saldo inconsistente',()=>{expect(()=>saldoLegado(5,[6])).toThrow();expect(()=>saldoLegado(5,[-1])).toThrow();});
});
