import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { converterQuantidade, dataCompra, ratearTotal, custoMedio, valorRecebido } from './compras-regras';
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

describe('Recebimento de compras', () => {
  it('preserva centavos no recebimento parcial', () => {
    const valores = [0, 1, 2].map(n => valorRecebido(d(10), 3, n, 1));
    expect(valores.reduce((a,b) => a.plus(b), d(0)).toNumber()).toBe(10);
    expect(() => valorRecebido(d(10), 3, 2, 2)).toThrow();
  });
  it('calcula custo médio ponderado pelo estoque', () => {
    expect(custoMedio(10, d(4), 10, d(60)).toNumber()).toBe(5);
    expect(() => custoMedio(-1, d(4), 10, d(60))).toThrow();
  });
});
