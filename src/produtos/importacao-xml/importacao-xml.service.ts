import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { PrismaService } from '../../core/prisma/prisma.service';
import { XmlConfirmDto } from './importacao-xml.dto';

const str = (value: unknown) => String(value ?? '').trim();
const positiveMoney = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new BadRequestException('Valor monetário inválido no XML.');
  return n;
};
const cnpj = (value: unknown) => str(value).replace(/\D/g,'');
const asList = (value: unknown): any[] => value === undefined ? [] : Array.isArray(value) ? value : [value];

@Injectable()
export class ImportacaoXmlService {
  constructor(private readonly prisma: PrismaService) {}

  private parse(xml: string) {
    if (typeof xml !== 'string' || Buffer.byteLength(xml,'utf8') > 1000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
      throw new BadRequestException('XML inválido, muito grande ou contendo entidades não permitidas.');
    }
    if (XMLValidator.validate(xml) !== true) throw new BadRequestException('O arquivo não contém um XML válido.');
    let root: any;
    try {
      root = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,trimValues:true,processEntities:false}).parse(xml);
    } catch { throw new BadRequestException('Não foi possível interpretar o arquivo XML.'); }
    const nota = root?.nfeProc?.NFe ?? root?.NFe;
    const inf = nota?.infNFe;
    if (!inf?.ide || !inf?.emit || !inf?.det || !inf?.total?.ICMSTot) {
      throw new BadRequestException('É necessário um XML completo de NF-e com identificação, emitente, itens e totais.');
    }
    const modelo = str(inf.ide.mod);
    if (modelo !== '55') throw new BadRequestException('Importe uma NF-e modelo 55.');
    const chave = str(inf['@_Id']).replace(/^NFe/,'');
    if (!/^\d{44}$/.test(chave)) throw new BadRequestException('A NF-e precisa possuir chave de acesso de 44 dígitos.');
    const emitCnpj = cnpj(inf.emit.CNPJ);
    if (emitCnpj.length !== 14) throw new BadRequestException('CNPJ do emitente inválido.');
    const numero = str(inf.ide.nNF);
    const data = new Date(str(inf.ide.dhEmi ?? inf.ide.dEmi));
    if (!numero || Number.isNaN(data.getTime())) throw new BadRequestException('Número ou data da NF-e inválidos.');
    const valor = positiveMoney(inf.total.ICMSTot.vNF);
    const itens = asList(inf.det).map((det: any,index:number) => {
      const p = det?.prod;
      if (!p || !str(p.xProd)) throw new BadRequestException('Item da NF-e sem descrição.');
      const quantidade=Number(p.qCom);
      if (!Number.isSafeInteger(quantidade) || quantidade<=0) {
        throw new BadRequestException('O item '+(index+1)+' usa quantidade fracionária ou inválida. Ajuste a unidade antes de importar.');
      }
      return {indice:index,codigo:str(p.cProd),ean:/^\d{8,14}$/.test(str(p.cEAN))?str(p.cEAN):null,nome:str(p.xProd),quantidade,valorUnitario:positiveMoney(p.vUnCom)};
    });
    if (!itens.length || itens.length>300) throw new BadRequestException('A NF-e deve ter entre 1 e 300 itens.');
    return {chave,numero,data,valor,fornecedor:{cnpj:emitCnpj,razaoSocial:str(inf.emit.xNome)},destinatarioCnpj:cnpj(inf.dest?.CNPJ),itens};
  }

  async preview(empresaId:number,xml:string) {
    const nf=this.parse(xml);
    const [empresa,fornecedor,existente,produtos]=await Promise.all([
      this.prisma.empresa.findUnique({where:{id:empresaId},select:{cnpj:true}}),
      this.prisma.fornecedor.findFirst({where:{empresaId,cnpj:nf.fornecedor.cnpj},select:{id:true,razaoSocial:true}}),
      this.prisma.notaFiscal.findUnique({where:{empresaId_chaveAcesso:{empresaId,chaveAcesso:nf.chave}},select:{id:true}}),
      this.prisma.produto.findMany({where:{empresaId,ativo:true},select:{id:true,nome:true,codigoBarras:true,estoqueAtual:true}}),
    ]);
    if (empresa?.cnpj && cnpj(empresa.cnpj)!==nf.destinatarioCnpj) throw new BadRequestException('O destinatário da NF-e deve corresponder ao CNPJ desta distribuidora.');
    if (existente) throw new ConflictException('Esta NF-e já foi importada para esta distribuidora.');
    return {...nf,data:nf.data.toISOString(),fornecedorExistente:fornecedor,produtos,
      itens:nf.itens.map(item=>({...item,produtoSugeridoId:item.ean?produtos.find(p=>p.codigoBarras===item.ean)?.id??null:null}))};
  }

  async confirmar(empresaId:number,dto:XmlConfirmDto) {
    const nf=await this.preview(empresaId,dto.xml);
    const map=new Map(dto.mapeamentos.map(v=>[v.indice,v.produtoId]));
    if (map.size!==nf.itens.length || nf.itens.some(i=>!map.has(i.indice))) throw new BadRequestException('Associe todos os itens da nota aos produtos do estoque.');
    const ids=[...new Set(map.values())];
    const produtos=await this.prisma.produto.findMany({where:{empresaId,id:{in:ids},ativo:true},select:{id:true}});
    if(produtos.length!==ids.length) throw new BadRequestException('Produto não localizado ou não pertence à empresa.');
    if(dto.gerarContaPagar && (!dto.vencimento || Number.isNaN(new Date(dto.vencimento).getTime()))) {
      throw new BadRequestException('Informe um vencimento válido para gerar a conta a pagar.');
    }
    try {
      return await this.prisma.$transaction(async tx=>{
        let fornecedor=await tx.fornecedor.findFirst({where:{empresaId,cnpj:nf.fornecedor.cnpj}});
        if(!fornecedor) fornecedor=await tx.fornecedor.create({data:{
          empresaId,cnpj:nf.fornecedor.cnpj,razaoSocial:nf.fornecedor.razaoSocial || 'Fornecedor do XML'
        }});
        const nota=await tx.notaFiscal.create({data:{
          empresaId,chaveAcesso:nf.chave,numeroNota:nf.numero,fornecedorId:fornecedor.id,
          valorTotal:nf.valor,dataEmissao:new Date(nf.data)
        }});
        for(const item of nf.itens){
          const produtoId=map.get(item.indice)!;
          await tx.itemNotaFiscal.create({data:{notaFiscalId:nota.id,produtoId,quantidade:item.quantidade,valorUnitario:item.valorUnitario}});
          await tx.produto.update({where:{id:produtoId},data:{estoqueAtual:{increment:item.quantidade}}});
          await tx.movimentacaoEstoque.create({data:{
            empresaId,produtoId,tipo:'ENTRADA_COMPRA',quantidade:item.quantidade,
            motivo:'Importação XML NF-e '+nf.numero+' · '+nf.chave
          }});
        }
        if(dto.gerarContaPagar) await tx.contaPagar.create({data:{
          empresaId,notaFiscalId:nota.id,descricao:'NF-e '+nf.numero+' — '+fornecedor.razaoSocial,
          categoria:'COMPRA DE MERCADORIAS',valor:nf.valor,dataVencimento:new Date(dto.vencimento!)
        }});
        return {notaFiscalId:nota.id,numeroNota:nf.numero,itensImportados:nf.itens.length,contaPagarCriada:!!dto.gerarContaPagar};
      });
    } catch(err:any) {
      if(err?.code==='P2002') throw new ConflictException('Nota ou fornecedor duplicado. Confira se a importação já foi concluída.');
      throw err;
    }
  }
}
