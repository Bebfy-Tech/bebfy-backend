import { BadRequestException } from '@nestjs/common';

/** Normalizes formatting without losing leading zeroes or CNPJ letters. */
export const normalizarDocumento=(v:string|null|undefined)=>String(v??'').trim().toUpperCase().replace(/[.\s\/-]/g,'');
export function validarDocumento(value:string|null|undefined):string|null{
 const d=normalizarDocumento(value);
 if(!d)return null;
 if(/^(\d)\1+$/.test(d))throw new BadRequestException('CPF/CNPJ inválido.');
 if(/^\d{11}$/.test(d)){
  const dv=(s:string)=>{const r=Array.from(s).reduce((a,v,i)=>a+Number(v)*(s.length+1-i),0)%11;return r<2?0:11-r;};
  if(dv(d.slice(0,9))===Number(d[9])&&dv(d.slice(0,10))===Number(d[10]))return d;
 }else if(/^[0-9A-Z]{12}\d{2}$/.test(d)){
  // CNPJ numeric and alphanumeric use modulus 11 and ASCII minus 48.
  const dv=(s:string)=>{const r=Array.from(s).reduce((a,v,i)=>a+(v.charCodeAt(0)-48)*(2+(s.length-1-i)%8),0)%11;return r<2?0:11-r;};
  if(dv(d.slice(0,12))===Number(d[12])&&dv(d.slice(0,13))===Number(d[13]))return d;
 }
 throw new BadRequestException('CPF/CNPJ inválido. Confira os dígitos verificadores.');
}
