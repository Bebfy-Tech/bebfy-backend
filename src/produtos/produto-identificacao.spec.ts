import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, it, expect, vi } from 'vitest';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { ProdutosService } from './produtos.service';
import { ImportacaoXmlService } from './importacao-xml/importacao-xml.service';

describe('Identificação comercial e fiscal do produto', () => {
  const dados = { nome:'Produto QA', precoVendaVarejo:8, marca:'Marca QA', fabricante:'Fabricante QA', descricaoComplementar:'Descrição QA', grupo:'Bebidas', subgrupo:'Refrigerantes', ncm:'02201000', cest:'0300100' };
  it('aceita todos os campos e preserva zeros à esquerda', async () => {
    expect(await validate(Object.assign(new CreateProdutoDto(),dados))).toEqual([]);
    const create=vi.fn().mockResolvedValue(dados);
    const tx:any={produto:{create},empresa:{updateMany:vi.fn().mockResolvedValue({count:0})},unidadeMedida:{findFirst:vi.fn().mockResolvedValue({id:'un',sigla:'UN',tipo:'CONTAGEM'}),updateMany:vi.fn().mockResolvedValue({count:1})}};
    await new ProdutosService({$transaction:(fn:any)=>fn(tx)} as any).create(dados,7);
    expect(create).toHaveBeenCalledWith({data:{...dados,empresaId:7,unidadeMedidaId:'un',unidadeMedida:'UN',unidadeEmbalagemId:null,unidadeEmbalagemSigla:null}});
  });
  it('mantém compatibilidade com cadastro antigo', async () => {
    expect(await validate(Object.assign(new CreateProdutoDto(),{nome:'Teste',precoVendaVarejo:5}))).toEqual([]);
  });
  it('rejeita códigos inválidos e textos longos', async () => {
    const errors=await validate(Object.assign(new CreateProdutoDto(),{...dados,ncm:'12A45678',cest:'1234',marca:'x'.repeat(121)}));
    expect(errors.map(e=>e.property)).toEqual(expect.arrayContaining(['ncm','cest','marca']));
  });
  it('permite limpar campos opcionais na edição', async () => {
    expect(await validate(Object.assign(new UpdateProdutoDto(),{ncm:null,cest:null,marca:null}))).toEqual([]);
    const update=vi.fn().mockResolvedValue({});
    const findFirst=vi.fn().mockResolvedValue({id:1,unidadeMedida:'UN',unidadeMedidaId:'un',fardoQuantidade:1});
    const tx:any={produto:{findFirst,update},empresa:{updateMany:vi.fn().mockResolvedValue({count:0})}};
    await new ProdutosService({$transaction:(fn:any)=>fn(tx)} as any).update(1,{ncm:null,cest:null,marca:null},7);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{id:1,empresaId:7,ativo:true}}));
    expect(update).toHaveBeenCalledWith({where:{id:1},data:{ncm:null,cest:null,marca:null,unidadeMedida:'UN',unidadeMedidaId:'un',unidadeEmbalagemId:null,unidadeEmbalagemSigla:null}});
  });
  it('lê NCM e CEST como texto no preview do XML sem atualizar produto', async () => {
    const findMany=vi.fn().mockResolvedValue([]);
    const prisma:any={empresa:{findUnique:vi.fn().mockResolvedValue(null)},$queryRaw:vi.fn().mockResolvedValue([]),fornecedor:{findFirst:vi.fn().mockResolvedValue(null)},notaFiscal:{findUnique:vi.fn().mockResolvedValue(null)},produto:{findMany}};
    const xml='<NFe><infNFe Id="NFe'+ '1'.repeat(44)+'"><ide><mod>55</mod><nNF>1</nNF><dhEmi>2026-11-26T12:00:00-03:00</dhEmi></ide><emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor</xNome></emit><det><prod><xProd>Teste</xProd><NCM>02201000</NCM><CEST>0300100</CEST><qCom>1</qCom><vUnCom>5</vUnCom></prod></det><total><ICMSTot><vNF>5</vNF></ICMSTot></total></infNFe></NFe>';
    const result=await new ImportacaoXmlService(prisma).preview(7,xml);
    expect(result.itens[0]).toMatchObject({ncm:'02201000',cest:'0300100'});
  });
});
