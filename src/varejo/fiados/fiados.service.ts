// Importamos os decoradores e exceções padrão do NestJS
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// Importamos o PrismaService e o Enum de transações
import { PrismaService } from '../../core/prisma/prisma.service';
import { CreateFiadoDto } from './dto/create-fiado.dto';
import { TipoTransacaoFiado } from '@prisma/client';

@Injectable()
export class FiadosService {
  constructor(private readonly prisma: PrismaService) {}

  // Lança um novo registro no histórico do fiado e atualiza o saldo do cliente de forma atômica
  async create(createFiadoDto: CreateFiadoDto) {
    // 1. Localiza o cliente na base de dados
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: createFiadoDto.clienteId },
    });

    if (!cliente) {
      throw new NotFoundException('O cliente informado não foi encontrado.');
    }

    const valorNum = Number(createFiadoDto.valor);
    const saldoAtual = Number(cliente.saldoDevedor);
    const limiteCredito = Number(cliente.limiteCredito);

    // 2. Validação de Limite de Crédito para compras/débitos novos
    if (createFiadoDto.tipo === TipoTransacaoFiado.DEBITO) {
      const saldoProjetado = saldoAtual + valorNum;
      if (limiteCredito > 0 && saldoProjetado > limiteCredito) {
        throw new BadRequestException(
          `Operação bloqueada: O novo saldo (R$ ${saldoProjetado.toFixed(
            2,
          )}) ultrapassaria o limite de crédito permitido (R$ ${limiteCredito.toFixed(
            2,
          )}).`,
        );
      }
    }

    // 3. Executa a atualização de saldo e inserção no histórico em uma transação do banco de dados
    return this.prisma.$transaction(async (tx) => {
      // Calcula o novo saldo após o lançamento
      let novoSaldo = saldoAtual;
      if (createFiadoDto.tipo === TipoTransacaoFiado.CREDITO) {
        novoSaldo -= valorNum; // Abate da dívida
      } else {
        novoSaldo += valorNum; // Incrementa a dívida
      }

      // Atualiza o saldoDevedor no cadastro do cliente
      await tx.cliente.update({
        where: { id: createFiadoDto.clienteId },
        data: {
          saldoDevedor: novoSaldo,
        },
      });

      // Cria o registro no histórico de fiados guardando o saldoApos
      return tx.historicoFiado.create({
        data: {
          clienteId: createFiadoDto.clienteId,
          vendaId: createFiadoDto.vendaId,
          tipo: createFiadoDto.tipo,
          valor: createFiadoDto.valor,
          descricao: createFiadoDto.descricao,
          saldoApos: novoSaldo,
        },
      });
    });
  }

  // Lista todos os lançamentos de fiado cadastrados na distribuidora
  async findAll() {
    return this.prisma.historicoFiado.findMany({
      include: {
        cliente: true,
        venda: true,
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  // Busca o extrato/histórico completo de fiados de um único cliente
  async findByCliente(clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado.');
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
