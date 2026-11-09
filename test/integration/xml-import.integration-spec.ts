import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ImportacaoXmlService } from '../../src/produtos/importacao-xml/importacao-xml.service';

const xml = (quantity='6', cnpjDest='11222333000181') => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
<NFe><infNFe Id="NFe${'3'.repeat(44)}">
<ide><mod>55</mod><nNF>1427</nNF><dhEmi>2026-11-09T10:15:00-03:00</dhEmi></ide>
<emit><CNPJ>44333222000177</CNPJ><xNome>Fornecedor QA</xNome></emit>
<dest><CNPJ>${cnpjDest}</CNPJ></dest>
<det nItem="1"><prod><cProd>ABC-1</cProd><cEAN>7891234567890</cEAN><xProd>Cerveja 350ml</xProd><qCom>${quantity}</qCom><vUnCom>4.50</vUnCom></prod></det>
<total><ICMSTot><vNF>27.00</vNF></ICMSTot></total>
</infNFe></NFe>
</nfeProc>`;

function fixture({ duplicate=false, companyCnpj='11222333000181' }={}) {
 const prisma:any = {
  empresa: {findUnique:vi.fn().mockResolvedValue({cnpj:companyCnpj})},
  fornecedor: {findFirst:vi.fn().mockResolvedValue(null)},
  notaFiscal:{findUnique:vi.fn().mockResolvedValue(duplicate?{id:'existing'}:null)},
  produto:{findMany:vi.fn().mockResolvedValue([{id:19,nome:'Cerveja 350ml',codigoBarras:'7891234567890',estoqueAtual:10}])},
 };
 return { service: new ImportacaoXmlService(prisma), prisma };
}

describe('Importação de NF-e XML sem integração externa', () => {
 it('lê nota modelo 55, sugere associação por EAN e não grava estoque na prévia', async () => {
  const { service,prisma }=fixture();
  const result=await service.preview(1,xml());
  expect(result.numero).toBe('1427');
  expect(result.valor).toBe(27);
  expect(result.fornecedor.razaoSocial).toBe('Fornecedor QA');
  expect(result.itens[0]).toMatchObject({quantidade:6,valorUnitario:4.5,produtoSugeridoId:19});
  expect(prisma.produto.findMany).toHaveBeenCalledOnce();
  expect(prisma.produto.update).toBeUndefined();
 });
 it('rejeita XML com entidades externas',async()=>{
  const {service}=fixture();
  await expect(service.preview(1,'<!DOCTYPE a [<!ENTITY secret SYSTEM "file:///etc/passwd">]>'+xml())).rejects.toBeInstanceOf(BadRequestException);
 });
 it('impede importação de nota já cadastrada para a empresa',async()=>{
  const {service}=fixture({duplicate:true});
  await expect(service.preview(1,xml())).rejects.toBeInstanceOf(ConflictException);
 });
 it('impede XML destinado a outro CNPJ',async()=>{
  const {service}=fixture();
  await expect(service.preview(1,xml('6','99000199000199'))).rejects.toBeInstanceOf(BadRequestException);
 });
 it('rejeita quantidade fracionária para evitar distorção do estoque',async()=>{
  const {service}=fixture();
  await expect(service.preview(1,xml('2.5'))).rejects.toBeInstanceOf(BadRequestException);
 });
 it('não permite confirmar a NF-e sem mapear todos os produtos',async()=>{
  const {service}=fixture();
  await expect(service.confirmar(1,{xml:xml(),mapeamentos:[]})).rejects.toBeInstanceOf(BadRequestException);
 });
});
