import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const decimal = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export function dataCompra(s: string) {
  const data = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== s)
    throw new BadRequestException('Data inválida.');
  return data;
}

/** Distribuição proporcional do valor final, preservando todos os centavos. */
export function ratearTotal(subtotais: Prisma.Decimal[], frete: Prisma.Decimal, desconto: Prisma.Decimal) {
  const subtotal = subtotais.reduce((a, b) => a.plus(b), decimal(0));
  const total = subtotal.plus(frete).minus(desconto);
  if (!subtotais.length || subtotais.some(v => v.lte(0)) || frete.lt(0) || desconto.lt(0) || total.lte(0) || total.gt(999999999))
    throw new BadRequestException('Total da compra inválido.');
  let acumulado = decimal(0), anterior = decimal(0);
  const itens = subtotais.map(v => {
    acumulado = acumulado.plus(v);
    const atual = total.mul(acumulado).div(subtotal).toDecimalPlaces(2);
    const valor = atual.minus(anterior);
    anterior = atual;
    return valor;
  });
  return { subtotal, total, itens };
}
export function converterQuantidade(quantidade: number, fator: number) {
  const unidades = quantidade * fator;
  if (!Number.isSafeInteger(quantidade) || quantidade < 1 || !Number.isSafeInteger(fator) || fator < 1 || !Number.isSafeInteger(unidades) || unidades > 1000000000)
    throw new BadRequestException('Quantidade de compra inválida.');
  return unidades;
}
