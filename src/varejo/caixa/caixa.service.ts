// Importamos os decoradores e exceções padrão do NestJS
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
// Importamos o PrismaService e os Enums do banco
import { PrismaService } from '../../core/prisma/prisma.service';
import { AbrirCaixaDto } from './dto/abrir-caixa.dto';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';
import { MovimentacaoCaixaDto } from './dto/movimentacao-caixa.dto';
import { StatusCaixa, TipoMovimentacaoCaixa } from '@prisma/client';

@Injectable()
export class CaixaService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Abre um novo caixa para o operador com validação da empresa
  async abrirCaixa(abrirCaixaDto: AbrirCaixaDto, empresaId: number = 1) {
    // Verifica se o operador/funcionário existe nesta empresa
    const operador = await this.prisma.funcionario.findFirst({
      where: {
        id: abrirCaixaDto.operadorId,
        empresaId,
      },
    });

    if (!operador) {
      throw new NotFoundException('O operador informado não foi encontrado nesta empresa.');
    }

    // Impede a abertura se o operador já tiver um caixa em aberto
    const caixaAberto = await this.prisma.caixa.findFirst({
      where: {
        operadorId: abrirCaixaDto.operadorId,
        status: StatusCaixa.ABERTO,
      },
    });

    if (caixaAberto) {
      throw new BadRequestException(
        'Já existe um caixa ABERTO para este operador.',
      );
    }

    // Cria o registro do caixa
    return this.prisma.caixa.create({
      data: {
        operadorId: abrirCaixaDto.operadorId,
        saldoInicial: abrirCaixaDto.saldoInicial,
        status: StatusCaixa.ABERTO,
      } as any,
    });
  }

  // 2. Registra Sangria ou Suprimento no caixa ativo
  async adicionarMovimentacao(
    caixaId: string,
    movimentacaoDto: MovimentacaoCaixaDto,
    empresaId: number = 1,
  ) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      include: { operador: true },
    });

    const operadorEmpresaId = (caixa?.operador as any)?.empresaId;

    if (!caixa || (operadorEmpresaId && operadorEmpresaId !== empresaId)) {
      throw new NotFoundException('Caixa não encontrado nesta empresa.');
    }

    if (caixa.status !== StatusCaixa.ABERTO) {
      throw new BadRequestException(
        'Não é possível realizar movimentações em um caixa FECHADO.',
      );
    }

    return this.prisma.movimentacaoCaixa.create({
      data: {
        caixaId,
        tipo: movimentacaoDto.tipo,
        valor: movimentacaoDto.valor,
        categoria: movimentacaoDto.categoria,
        observacao: movimentacaoDto.observacao,
      },
    });
  }

  // 3. Efetua o fechamento do caixa e calcula o saldo do sistema e a quebra de caixa
  async fecharCaixa(
    caixaId: string,
    fecharCaixaDto: FecharCaixaDto,
    empresaId: number = 1,
  ) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      include: {
        operador: true,
        movimentacoes: true,
      },
    });

    const operadorEmpresaId = (caixa?.operador as any)?.empresaId;

    if (!caixa || (operadorEmpresaId && operadorEmpresaId !== empresaId)) {
      throw new NotFoundException('Caixa não encontrado nesta empresa.');
    }

    if (caixa.status === StatusCaixa.FECHADO) {
      throw new BadRequestException('Este caixa já se encontra FECHADO.');
    }

    // Soma todas as entradas extras (suprimentos)
    const totalSuprimentos = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SUPRIMENTO)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    // Soma todas as retiradas (sangrias)
    const totalSangrias = caixa.movimentacoes
      .filter((m) => m.tipo === TipoMovimentacaoCaixa.SANGRIA)
      .reduce((acc, m) => acc + Number(m.valor), 0);

    // Cálculo do saldo esperado no sistema = Saldo Inicial + Suprimentos - Sangrias
    const saldoInicial = Number(caixa.saldoInicial);
    const saldoFinalSistema = saldoInicial + totalSuprimentos - totalSangrias;

    // Cálculo da quebra de caixa (Diferença entre o físico contado e o calculado pelo sistema)
    const saldoFisico = Number(fecharCaixaDto.saldoFinalFisico);
    const quebraDeCaixa = saldoFisico - saldoFinalSistema;

    // Atualiza e encerra o caixa
    return this.prisma.caixa.update({
      where: { id: caixaId },
      data: {
        saldoFinalSistema,
        saldoFinalFisico: saldoFisico,
        quebraDeCaixa,
        status: StatusCaixa.FECHADO,
        fechadoEm: new Date(),
      },
    });
  }

  // 4. Busca o caixa atualmente aberto de um operador
  async findCaixaAbertoPorOperador(operadorId: string, empresaId: number = 1) {
    const caixa = await this.prisma.caixa.findFirst({
      where: {
        operadorId,
        status: StatusCaixa.ABERTO,
      },
      include: {
        operador: true,
        movimentacoes: {
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    const operadorEmpresaId = (caixa?.operador as any)?.empresaId;

    if (!caixa || (operadorEmpresaId && operadorEmpresaId !== empresaId)) {
      throw new NotFoundException(
        'Nenhum caixa ABERTO localizado para este operador nesta empresa.',
      );
    }

    return caixa;
  }

  // 5. Lista todos os caixas cadastrados na empresa
  async findAll(empresaId: number = 1) {
    const caixas = await this.prisma.caixa.findMany({
      include: {
        operador: true,
        movimentacoes: true,
      },
      orderBy: {
        abertoEm: 'desc',
      },
    });

    return caixas.filter((caixa) => {
      const opEmpresaId = (caixa.operador as any)?.empresaId;
      return !opEmpresaId || opEmpresaId === empresaId;
    });
  }

  // 6. Detalha um caixa específico pelo ID
  async findOne(id: string, empresaId: number = 1) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id },
      include: {
        operador: true,
        movimentacoes: true,
        vendas: true,
      },
    });

    const operadorEmpresaId = (caixa?.operador as any)?.empresaId;

    if (!caixa || (operadorEmpresaId && operadorEmpresaId !== empresaId)) {
      throw new NotFoundException(`Caixa com o ID ${id} não foi encontrado nesta empresa.`);
    }

    return caixa;
  }
}