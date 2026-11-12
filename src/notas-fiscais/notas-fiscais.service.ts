import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { PrismaService } from '../core/prisma/prisma.service';
import { ImportarNfeDto } from './dto/importar-nfe.dto';

function texto(v: unknown): string {
  return String(v ?? '').trim();
}

@Injectable()
export class NotasFiscaisService {
  constructor(private readonly prisma: PrismaService) {}

  async importar(empresaId: number, dto: ImportarNfeDto) {
    if (!dto.xml || dto.xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(dto.xml)) {
      throw new BadRequestException('XML inválido, grande demais ou com entidades externas.');
    }
    if (XMLValidator.validate(dto.xml) !== true) {
      throw new BadRequestException('Documento XML malformado.');
    }
    const xml = new XMLParser({
      ignoreAttributes: false, removeNSPrefix: true,
      parseTagValue: false, parseAttributeValue: false, trimValues: true,
      processEntities: false,
    }).parse(dto.xml);

    const processo = xml.nfeProc || xml.procNFe;
    const nfe = processo?.NFe || xml.NFe;
    const infNFe = nfe?.infNFe;
    const protocolo = processo?.protNFe?.infProt;
    if (!infNFe || texto(protocolo?.cStat) !== '100') {
      throw new BadRequestException('Apenas XML de NF-e com protocolo de autorização informado pode gerar entrada de estoque.');
    }

    const chaveAcesso = texto(infNFe['@_Id']).replace(/^NFe/, '');
    if (!/^\d{44}$/.test(chaveAcesso)) {
      throw new BadRequestException('Chave de acesso da NF-e inválida.');
    }
    const emit = infNFe.emit;
    const cnpj = texto(emit?.CNPJ || emit?.CPF).replace(/\D/g, '');
    const razaoSocial = texto(emit?.xNome);
    if (!cnpj || !razaoSocial) {
      throw new BadRequestException('Dados do fornecedor ausentes no XML.');
    }

    const det = Array.isArray(infNFe.det) ? infNFe.det : infNFe.det ? [infNFe.det] : [];
    if (!det.length || det.length > 500) {
      throw new BadRequestException('Quantidade de itens da NF-e inválida.');
    }
    const mappings = new Map((dto.mapeamentos || []).map(m => [m.numeroItem, m.produtoId]));
    const dataEmissao = new Date(texto(infNFe.ide?.dhEmi || infNFe.ide?.dEmi));
    if (Number.isNaN(dataEmissao.getTime())) {
      throw new BadRequestException('Data de emissão inválida.');
    }
    const valorTotal = Number(infNFe.total?.ICMSTot?.vNF);
    if (!Number.isFinite(valorTotal) || valorTotal < 0) {
      throw new BadRequestException('Valor total inválido.');
    }

    return this.prisma.$transaction(async tx => {
      const existente = await tx.notaFiscal.findFirst({ where: { empresaId, chaveAcesso } });
      if (existente) throw new ConflictException('Esta NF-e já foi importada nesta empresa.');

      const fornecedor = await tx.fornecedor.upsert({
        where: { empresaId_cnpj: { empresaId, cnpj } },
        create: { empresaId, cnpj, razaoSocial, nomeFantasia: texto(emit.xFant) || null },
        update: { razaoSocial, nomeFantasia: texto(emit.xFant) || null },
      });

      const nota = await tx.notaFiscal.create({
        data: {
          empresaId, chaveAcesso,
          numeroNota: texto(infNFe.ide?.nNF), fornecedorId: fornecedor.id,
          valorTotal, dataEmissao,
        },
      });

      for (const item of det) {
        const numeroItem = Number(item['@_nItem']);
        const prod = item.prod;
        const quantidade = Number(prod?.qCom);
        const precoUnitario = Number(prod?.vUnCom);
        if (!Number.isInteger(numeroItem) || numeroItem < 1 ||
            !Number.isSafeInteger(quantidade) || quantidade < 1 ||
            !Number.isFinite(precoUnitario) || precoUnitario < 0) {
          throw new BadRequestException('Itens da NF-e têm quantidades ou preços incompatíveis com o estoque em unidades.');
        }

        let produtoId = mappings.get(numeroItem);
        if (!produtoId) {
          const codigoBarras = texto(prod?.cEAN).replace(/\D/g, '');
          const produto = codigoBarras
            ? await tx.produto.findFirst({ where: { empresaId, codigoBarras, ativo: true } })
            : null;
          produtoId = produto?.id;
        }
        if (!produtoId) {
          throw new BadRequestException('Associe todos os itens da NF-e aos produtos cadastrados antes da importação.');
        }
        const produto = await tx.produto.findFirst({ where: { id: produtoId, empresaId, ativo: true } });
        if (!produto) throw new BadRequestException('Produto associado não existe nesta empresa.');

        await tx.itemNotaFiscal.create({
          data: { notaFiscalId: nota.id, produtoId, quantidade, valorUnitario: precoUnitario },
        });
        await tx.produto.update({
          where: { id: produtoId }, data: { estoqueAtual: { increment: quantidade } },
        });
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId, produtoId, quantidade,
            tipo: 'ENTRADA_COMPRA',
            motivo: `NF-e ${chaveAcesso}`,
          },
        });
      }
      return tx.notaFiscal.findUnique({
        where: { id: nota.id },
        include: { itens: true, fornecedor: true },
      });
    });
  }

  async listar(empresaId: number) {
    return this.prisma.notaFiscal.findMany({
      where: { empresaId },
      include: { fornecedor: true, itens: true },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
