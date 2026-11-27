import { BadRequestException } from '@nestjs/common';
export function parcelasMensais(valor:number,data:string,modo:string,n:number){
 const total=Math.round(valor*100);
 if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(n)||n<1||n>60||modo==='PARCELADA'&&total<n)throw new BadRequestException('Valor ou número de parcelas inválido.');
 const d=new Date(data+'T00:00:00Z');
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==data)throw new BadRequestException('Vencimento inválido.');
 return Array.from({length:n},(_,i)=>{
  const m=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+i,1));
  m.setUTCDate(Math.min(d.getUTCDate(),new Date(Date.UTC(m.getUTCFullYear(),m.getUTCMonth()+1,0)).getUTCDate()));
  const cents=modo==='PARCELADA'?Math.floor(total/n)+(i<total%n?1:0):total;
  return {valor:cents/100,dataVencimento:m};
 });
}
