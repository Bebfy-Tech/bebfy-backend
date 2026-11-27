import { Prisma } from '@prisma/client';
import { valorBaixa } from './movimentos-financeiros.service';
const d=(n:number)=>new Prisma.Decimal(n);
describe('Valor efetivo das baixas',()=>{
 it('considera juros multa e desconto',()=>expect(valorBaixa({principal:d(100),juros:d(2),multa:d(1),desconto:d(5)}).toNumber()).toBe(98));
 it('estorno inverte o efeito financeiro',()=>expect(valorBaixa({principal:d(-100),juros:d(-2),multa:d(-1),desconto:d(-5)}).toNumber()).toBe(-98));
});
