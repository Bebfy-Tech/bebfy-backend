import { formasOperacionais, resolverPagamento } from '../../financeiro/pagamentos-operacionais';
import { exigirCredito } from '../clientes/credito';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { PagarFiadoDto } from './dto/pagar-fiado.dto';
import { TipoTransacaoFiado, TipoMovimentacaoCaixa, FormaPagamento } from '@prisma/client';

@Injectable()
export class FiadosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(empresaId: number, createFiadoDto: CreateFiadoDto) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: createFiadoDto.clienteId, empresaId, ativo: true },
    });

    if (!cliente) {
      throw new NotFoundException('O cliente informado não foi encontrado nesta empresa.');
    }

    const valorNum = Number(createFiadoDto.valor);
    const saldoAtual = Number(cliente.saldoDevedor);
    if (createFiadoDto.tipo === TipoTransacaoFiado.DEBITO) exigirCredito(cliente, valorNum);

    return this.prisma.$transaction(async (tx) => {
      if (createFiadoDto.vendaId) {
        const venda = await tx.venda.findFirst({ where: { id: createFiadoDto.vendaId, empresaId, clienteId: createFiadoDto.clienteId } });
        if (!venda) throw new BadRequestException('Venda não pertence ao cliente e empresa informados.');
      }
      let novoSaldo = saldoAtual;
      if (createFiadoDto.tipo === TipoTransacaoFiado.CREDITO) {
        novoSaldo -= valorNum;
      } else {
        novoSaldo += valorNum;
      }

      if (novoSaldo < 0) {
        throw new BadRequestException('Crédito superior ao saldo devedor.');
      }
      const alteracao = await tx.cliente.updateMany({
        where: {
          id: createFiadoDto.clienteId,
          empresaId,
          ativo: true,
          saldoDevedor: { equals: cliente.saldoDevedor },
          // Optimistic condition also guards concurrent manager changes to the credit policy.
          ...(createFiadoDto.tipo===TipoTransacaoFiado.DEBITO?{modalidadeCredito:cliente.modalidadeCredito,limiteCredito:cliente.limiteCredito}:{}),
        },
        data: { saldoDevedor: novoSaldo },
      });
      if (alteracao.count !== 1) {
        throw new ConflictException('O saldo do cliente mudou. Repita a operação para evitar duplicidade.');
      }

      return tx.historicoFiado.create({
        data: {
          clienteId: createFiadoDto.clienteId,
          vendaId: createFiadoDto.vendaId,
          tipo: createFiadoDto.tipo,
          origem: 'AJUSTE_MANUAL',
          valor: createFiadoDto.valor,
          descricao: createFiadoDto.descricao,
          saldoApos: novoSaldo,
        },
      });
    });
  }

  async formasPagamento(empresaId:number){
    const formas=await this.prisma.$transaction(tx=>formasOperacionais(tx,empresaId,'fiado'));
    return formas.map(f=>({id:f.id,nome:f.nome,formaPagamento:f.formaBase,maxParcelas:f.maxParcelas,taxas:f.taxas}));
  }
  async registrarPagamento(empresaId: number, clienteId: string, dto: PagarFiadoDto) {
    return this.prisma.$transaction(async (tx) => {
      const replay = async () => {
        if(!dto.chaveRecebimento)return null;
        const anterior=await tx.historicoFiado.findFirst({where:{chaveRecebimento:dto.chaveRecebimento,clienteId,cliente:{empresaId}}});
        if(!anterior)return null;
        if(!anterior.valor.equals(dto.valor)||anterior.formaRecebimento!==dto.formaPagamento||(dto.formaCadastroId&&anterior.formaCadastroId!==dto.formaCadastroId)||anterior.parcelasPagamento!==(dto.parcelas??1)||(anterior.caixaRecebimentoId??null)!==(dto.caixaId??null))throw new ConflictException('Chave de recebimento já utilizada com outros dados.');
        return {sucesso:true,saldoDevedorAtual:Number(anterior.saldoApos),historico:anterior};
      };
      const anterior=await replay();if(anterior)return anterior;
      // Synchronize with closing, using the same lock ordering as sales.
      if(dto.caixaId){
        const lock=await tx.caixa.updateMany({where:{id:dto.caixaId,empresaId,status:'ABERTO'},data:{status:'ABERTO'}});
        if(lock.count!==1)throw new BadRequestException('Caixa informado não está aberto nesta empresa.');
      }
      // Serialize receipts and recheck the key after acquiring the customer row lock.
      const travado=await tx.cliente.updateMany({where:{id:clienteId,empresaId,ativo:true},data:{ativo:true}});
      const repetido=await replay();if(repetido)return repetido;
      if(travado.count!==1)throw new NotFoundException('Cliente não encontrado nesta empresa.');
      const cliente = await tx.cliente.findFirst({
        where: { id: clienteId, empresaId, ativo: true },
      });

      if (!cliente) {
        throw new NotFoundException('Cliente não encontrado nesta empresa.');
      }

      const valorNum = Number(dto.valor);
      if (valorNum > Number(cliente.saldoDevedor)) {
        throw new BadRequestException('Pagamento superior ao saldo devedor do cliente.');
      }
      const abatimento = await tx.cliente.updateMany({
        where: { id: clienteId, empresaId, ativo:true, saldoDevedor: { gte: valorNum } },
        data: { saldoDevedor: { decrement: valorNum } },
      });
      if (abatimento.count !== 1) {
        throw new BadRequestException('Saldo insuficiente ou alterado durante o pagamento.');
      }

      const clienteAtualizado = await tx.cliente.findUniqueOrThrow({
        where: { id: clienteId }, select: { saldoDevedor: true },
      });
      const novoSaldo = Number(clienteAtualizado.saldoDevedor);

      const snapshot=await resolverPagamento(tx,empresaId,'fiado',dto.formaPagamento as FormaPagamento,dto.formaCadastroId,dto.parcelas??1,dto.valor);
      const historico = await tx.historicoFiado.create({
        data: {
          clienteId,
          tipo: TipoTransacaoFiado.CREDITO,
          origem: 'RECEBIMENTO',
          formaRecebimento: dto.formaPagamento as FormaPagamento,
          ...snapshot,
          caixaRecebimentoId: dto.caixaId,
          chaveRecebimento: dto.chaveRecebimento,
          valor: dto.valor,
          descricao: `Baixa de fiado no balcão - Forma: ${dto.formaPagamento}`,
          saldoApos: novoSaldo,
        },
      });

      if (dto.caixaId) {
        const caixa = await tx.caixa.findFirst({
          where: { id: dto.caixaId, empresaId, status: 'ABERTO' },
        });

        if (!caixa) {
          throw new BadRequestException('Caixa informado não está aberto nesta empresa.');
        }
        if (dto.formaPagamento === 'DINHEIRO') {
          await tx.movimentacaoCaixa.create({
            data: {
              caixaId: dto.caixaId,
              tipo: TipoMovimentacaoCaixa.SUPRIMENTO,
              valor: dto.valor,
              categoria: 'RECEBIMENTO_FIADO',
              observacao: `Recebimento de fiado do cliente ${cliente.nome} (${dto.formaPagamento})`,
            },
          });
        }
      }

      return {
        sucesso: true,
        saldoDevedorAtual: novoSaldo,
        historico,
      };
    });
  }

  async findAll(empresaId: number) {
    return this.prisma.historicoFiado.findMany({
      where: {
        cliente: {
          empresaId,
        },
      },
      include: {
        cliente: true,
        venda: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  async findByCliente(empresaId: number, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, empresaId },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado nesta empresa.');
    }

    return this.prisma.historicoFiado.findMany({
      where: { clienteId },
      include: {
        venda: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }
}