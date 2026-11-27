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

/** The difference of cumulative rounded values makes split receiving exact to the cent. */
export function valorRecebido(total: Prisma.Decimal, unidades: number, antes: number, agora: number) {
  if (!Number.isInteger(agora) || agora <= 0 || antes + agora > unidades)
    throw new BadRequestException('Quantidade acima do saldo do pedido.');
  const acumulado = (n: number) => total.mul(n).div(unidades).toDecimalPlaces(2);
  return acumulado(antes + agora).minus(acumulado(antes));
}
export function custoMedio(estoque: number, custo: Prisma.Decimal, unidades: number, valor: Prisma.Decimal) {
  if (estoque < 0 || custo.lt(0) || unidades <= 0) throw new BadRequestException('Saldo ou custo anterior inconsistente.');
  return custo.mul(estoque).plus(valor).div(estoque + unidades).toDecimalPlaces(6);
}
