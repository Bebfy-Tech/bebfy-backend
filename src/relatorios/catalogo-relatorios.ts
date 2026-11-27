import { BadRequestException } from '@nestjs/common';
import type { NomeModulo } from '@prisma/client';
type Def = {codigo:string;nome:string;grupo:string;descricao:string;periodo:boolean;modulos:NomeModulo[]};
export const RELATORIOS: Def[] = [
 {codigo:'001',nome:'Lista de reposição de estoque',grupo:'Estoque e compras',descricao:'Produtos zerados ou no mínimo, quantidade sugerida e lista para compras.',periodo:false,modulos:[]},
 {codigo:'002',nome:'Posição de estoque',grupo:'Estoque e compras',descricao:'Saldo, mínimo, código de barras e unidade dos produtos ativos.',periodo:false,modulos:[]},
 {codigo:'003',nome:'Lotes e vencimentos',grupo:'Estoque e compras',descricao:'Lotes vencidos ou a vencer nos próximos 30 dias.',periodo:false,modulos:['ESTOQUE_LOTES']},
 {codigo:'004',nome:'Vendas por período',grupo:'Vendas e caixa',descricao:'Vendas concluídas, operador, cliente e total.',periodo:true,modulos:['CAIXA_PDV']},
 {codigo:'005',nome:'Produtos mais vendidos',grupo:'Vendas e caixa',descricao:'Ranking por unidades de estoque abatidas e valor dos itens.',periodo:true,modulos:['CAIXA_PDV']},
 {codigo:'006',nome:'Vendas por forma de pagamento',grupo:'Vendas e caixa',descricao:'Valores líquidos de troco, agrupados por forma.',periodo:true,modulos:['CAIXA_PDV']},
 {codigo:'007',nome:'Perdas e avarias',grupo:'Estoque e compras',descricao:'Movimentações de perdas e avarias registradas.',periodo:true,modulos:[]},
 {codigo:'008',nome:'Clientes com fiado em aberto',grupo:'Financeiro',descricao:'Saldo devedor atual dos clientes.',periodo:false,modulos:['FIADOS']},
 {codigo:'009',nome:'Contas a pagar em aberto',grupo:'Financeiro',descricao:'Títulos pendentes, saldo e vencimento.',periodo:false,modulos:[]},
 {codigo:'010',nome:'Contas a receber em aberto',grupo:'Financeiro',descricao:'Títulos pendentes, saldo e vencimento.',periodo:false,modulos:[]},
 {codigo:'011',nome:'Fechamentos de caixa',grupo:'Vendas e caixa',descricao:'Valores de fechamento e diferenças por operador.',periodo:true,modulos:['CAIXA_PDV']},
 {codigo:'012',nome:'Recebimentos de compras',grupo:'Estoque e compras',descricao:'Mercadorias recebidas, fornecedores e valores, sem estornos.',periodo:true,modulos:['COMPRAS_FORNECEDORES']},
 {codigo:'013',nome:'DRE gerencial estimada',grupo:'Financeiro',descricao:'Receita de vendas, CMV histórico e estimativa legada, despesas classificadas por vencimento.',periodo:true,modulos:['CAIXA_PDV']},
];
export const permissaoRelatorio=(codigo:string)=>'RELATORIO_'+codigo;
export function podeRelatorio(codigo:string,user:{cargo?:string;permissoes?:string[]}) {
 return ['PROPRIETARIO','ADMINISTRADOR','GERENTE'].includes(user.cargo??'') || Boolean(user.permissoes?.includes(permissaoRelatorio(codigo)));
}
export function periodoRelatorio(inicio?:string,fim?:string){
 const parse=(s:string|undefined)=>{
  if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new BadRequestException('Informe datas no formato AAAA-MM-DD.');
  const d=new Date(s+'T00:00:00.000Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw new BadRequestException('Data inválida.');
  return d;
 };
 const a=parse(inicio),b=parse(fim);
 if(b<a||b.getTime()-a.getTime()>365*86400000)throw new BadRequestException('Período inválido ou superior a 366 dias.');
 // Horário operacional de Brasília (UTC-03) para registros com horário.
 return {gte:new Date(a.getTime()+3*3600000),lt:new Date(b.getTime()+27*3600000)};
}
export function reposicao(saldo:number,minimo:number){return {sugerida:Math.max(0,minimo-saldo),situacao:saldo<=0?'Zerado':saldo<minimo?'Abaixo do mínimo':'No mínimo'};}
