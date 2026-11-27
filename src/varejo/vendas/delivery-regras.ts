import { BadRequestException } from '@nestjs/common';
import { StatusEntrega } from '@prisma/client';
export function validarTransicaoEntrega(atual:StatusEntrega|null,novo:StatusEntrega,entregadorId:string|null,observacao?:string){
 const permitidos:Record<string,StatusEntrega[]>={LEGADO:['PENDENTE','ENTREGUE'],PENDENTE:['SEPARANDO'],SEPARANDO:['PENDENTE','SAIU_PARA_ENTREGA'],SAIU_PARA_ENTREGA:['ENTREGUE','NAO_ENTREGUE'],NAO_ENTREGUE:['SEPARANDO'],ENTREGUE:[]};
 if(!permitidos[atual??'LEGADO']?.includes(novo))throw new BadRequestException('Transição de entrega inválida. Atualize a lista.');
 if((novo==='SAIU_PARA_ENTREGA'||novo==='ENTREGUE')&&!entregadorId)throw new BadRequestException('Informe o entregador responsável.');
 if((novo==='NAO_ENTREGUE'||atual===null&&novo==='ENTREGUE')&&!observacao?.trim())throw new BadRequestException('Informe o motivo ou a confirmação manual da entrega antiga.');
}
export function resumoDelivery(pagamentos:{formaPagamento:string;valor:unknown;troco:unknown}[]){
 const formas:Record<string,number>={DINHEIRO:0,PIX:0,CARTAO_DEBITO:0,CARTAO_CREDITO:0,FIADO:0};
 for(const p of pagamentos){if(p.formaPagamento in formas)formas[p.formaPagamento]+=Math.round(Number(p.valor)*100)-Math.round(Number(p.troco??0)*100);}
 return formas;
}
