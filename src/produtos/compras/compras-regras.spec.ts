import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { converterQuantidade, dataCompra, ratearTotal } from './compras-regras';
const d = (v: number) => new Prisma.Decimal(v);
describe('Regras de pedidos de compra', () => {
  it('converte embalagens sem alterar o estoque', () => {
    expect(converterQuantidade(10, 12)).toBe(120);
    expect(() => converterQuantidade(1.5, 12)).toThrow();
    expect(() => converterQuantidade(1000000000, 12)).toThrow();
  });
  it('rateia frete e desconto sem perder centavos', () => {
    const r = ratearTotal([d(10), d(20), d(30)], d(1), d(0.01));
    expect(r.total.toNumber()).toBe(60.99);
    expect(r.itens.reduce((a, b) => a.plus(b), d(0)).equals(r.total)).toBe(true);
    expect(() => ratearTotal([d(10)], d(0), d(11))).toThrow();
  });
  it('rejeita datas impossíveis', () => {
    expect(() => dataCompra('2026-02-30')).toThrow();
    expect(dataCompra('2026-12-01').toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
});
