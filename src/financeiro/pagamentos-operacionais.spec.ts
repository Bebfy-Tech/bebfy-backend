import { Prisma } from '@prisma/client';
import { estimarTaxa } from './pagamentos-operacionais';
describe('Estimativa de recebimento',()=>{
 it('preserva centavos e taxa contratada',()=>{const r=estimarTaxa(new Prisma.Decimal('100.01'),{taxa:3.49,prazoDias:30});expect(r.valorTaxa?.toString()).toBe('3.49');expect(r.valorLiquidoPrevisto?.toString()).toBe('96.52');});
 it('não inventa taxa ou valor líquido sem configuração',()=>expect(estimarTaxa(new Prisma.Decimal(100),undefined).valorLiquidoPrevisto).toBeNull());
});
