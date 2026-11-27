import { Prisma, TipoCadastroFinanceiro, FormaBaixaFinanceira } from '@prisma/client';
export const normalizarNome=(v:string)=>v.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
export async function inicializarCadastros(tx:Prisma.TransactionClient,empresaId:number){
 // A flag, not an empty-table check: deleting a default never recreates it.
 const lock=await tx.empresa.updateMany({where:{id:empresaId,cadastrosFinanceirosInicializados:false},data:{cadastrosFinanceirosInicializados:true}});
 if(!lock.count)return;
 const rows:Prisma.CadastroFinanceiroCreateManyInput[]=[];
 const grupo=(tipo:TipoCadastroFinanceiro,nomes:string[])=>nomes.forEach(nome=>rows.push({empresaId,tipo,nome,nomeNormalizado:normalizarNome(nome)}));
 grupo('CUSTO_FIXO',['Aluguel','Salários fixos','Internet','Contabilidade','Mensalidade de sistemas']);
 grupo('CUSTO_VARIAVEL',['Compra de mercadorias','Combustível','Embalagens','Comissões','Taxas de cartão']);
 grupo('RECEITA',['Venda de mercadorias','Taxa de entrega','Outras receitas']);
 grupo('BANCO',['Caixa Econômica','Banco do Brasil','Itaú','Bradesco','Santander','Inter','Nubank','Sicredi','Sicoob']);
 grupo('OPERADORA',['Stone','Cielo','Rede','Getnet','PagBank']);
 const formas:[string,FormaBaixaFinanceira,boolean][]=[['Dinheiro','DINHEIRO',true],['PIX','PIX',true],['Cartão de crédito','CARTAO_CREDITO',true],['Cartão de débito','CARTAO_DEBITO',true],['Boleto','BOLETO',false],['Transferência','TRANSFERENCIA',false]];
 formas.forEach(([nome,formaBase,permitePdv])=>rows.push({empresaId,tipo:'FORMA_PAGAMENTO',nome,nomeNormalizado:normalizarNome(nome),formaBase,permitePdv,permitePagar:true,permiteReceber:true,maxParcelas:1}));
 rows.push({empresaId,tipo:'FORMA_PAGAMENTO',nome:'Fiado',nomeNormalizado:'fiado',fiado:true,permitePdv:true});
 await tx.cadastroFinanceiro.createMany({data:rows,skipDuplicates:true});
}
