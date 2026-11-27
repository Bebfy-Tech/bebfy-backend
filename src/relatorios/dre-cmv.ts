import { Prisma } from '@prisma/client';
type Item = {unidadesEstoque:number|null;quantidade:number;custoHistorico:{custoUnitario:Prisma.Decimal}|null;produto:{precoCusto:Prisma.Decimal}};
// Separar estimativas dos dados comprovadamente registrados, sem preencher o passado artificialmente.
export function calcularCmv(itens:Item[]){
 let historico=new Prisma.Decimal(0),estimado=new Prisma.Decimal(0),legados=0,semCusto=0,semUnidades=0;
 for(const i of itens){
  const custo=i.custoHistorico?.custoUnitario??i.produto.precoCusto;
  const unidades=i.unidadesEstoque??i.quantidade;
  if(custo.lte(0))semCusto++;
  if(i.unidadesEstoque===null)semUnidades++;
  if(i.custoHistorico&&i.unidadesEstoque!==null)historico=historico.plus(custo.mul(unidades));
  else {legados++;estimado=estimado.plus(custo.mul(unidades));}
 }
 return {historico,estimado,legados,semCusto,semUnidades};
}
