import { BadRequestException } from '@nestjs/common';
import { ModalidadeCredito, Prisma } from '@prisma/client';

/** A mode and its limit must be saved together. Legacy limit-only writes remain compatible. */
export function configurarCredito(modalidade?:ModalidadeCredito|null,limite?:number|null){
 if(modalidade===undefined&&limite===undefined)return {};
 if(modalidade===null||limite===null)throw new BadRequestException('Informe uma modalidade de crédito válida.');
 const modo=modalidade??(Number(limite)>0?ModalidadeCredito.LIMITADO:ModalidadeCredito.BLOQUEADO);
 if(!Object.values(ModalidadeCredito).includes(modo))throw new BadRequestException('Modalidade de crédito inválida.');
 if(limite!==undefined&&(!Number.isFinite(limite)||limite<0||!Number.isSafeInteger(Math.round(limite*100))||Math.abs(limite*100-Math.round(limite*100))>0.000001))throw new BadRequestException('Limite de crédito inválido.');
 if(modo===ModalidadeCredito.LIMITADO&&!(Number(limite)>0))throw new BadRequestException('Informe um limite de crédito maior que zero.');
 if(modo!==ModalidadeCredito.LIMITADO&&limite!==undefined&&limite!==0)throw new BadRequestException('Limite positivo exige crédito limitado.');
 return {modalidadeCredito:modo,limiteCredito:modo===ModalidadeCredito.LIMITADO?limite!:0};
}
/** Validate only new debt, never payments or reversals. Decimal avoids cent rounding errors. */
export function exigirCredito(cliente:{modalidadeCredito:ModalidadeCredito;limiteCredito:Prisma.Decimal|number|string;saldoDevedor:Prisma.Decimal|number|string},valor:number|string|Prisma.Decimal){
 const valorDecimal=new Prisma.Decimal(valor);
 if(!valorDecimal.isFinite()||valorDecimal.lte(0))throw new BadRequestException('Valor do fiado inválido.');
 if(cliente.modalidadeCredito===ModalidadeCredito.BLOQUEADO)throw new BadRequestException('Fiado bloqueado para este cliente.');
 if(cliente.modalidadeCredito===ModalidadeCredito.ILIMITADO)return;
 if(cliente.modalidadeCredito!==ModalidadeCredito.LIMITADO||new Prisma.Decimal(cliente.limiteCredito).lte(0))throw new BadRequestException('Crédito não configurado para este cliente.');
 if(new Prisma.Decimal(cliente.saldoDevedor).plus(valorDecimal).gt(cliente.limiteCredito))throw new BadRequestException('Limite de crédito do cliente excedido.');
}
