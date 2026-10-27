// Importamos os decoradores e exceções padrão do NestJS
import { Injectable, NotFoundException } from '@nestjs/common';
// Importamos o serviço do Prisma para executar as consultas no banco
import { PrismaService } from '../../core/prisma/prisma.service';
// Importamos os DTOs de validação de dados
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  // Injeta o PrismaService para manipular a tabela Cliente no PostgreSQL
  constructor(private readonly prisma: PrismaService) {}

  // Registra um novo cliente no banco de dados com isolamento por empresa
  async create(createClienteDto: CreateClienteDto, empresaId: number = 1) {
    return this.prisma.cliente.create({
      data: {
        ...createClienteDto,
        empresaId,
      } as any,
    });
  }

  // Lista todos os clientes cadastrados na empresa, do mais recente para o mais antigo
  async findAll(empresaId: number = 1) {
    return this.prisma.cliente.findMany({
      where: { empresaId } as any,
      include: {
        _count: {
          select: {
            vendas: true,  // Retorna a quantidade total de vendas associadas a este cliente
            fiados: true,  // Retorna o total de lançamentos de fiado no histórico
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    });
  }

  // Busca um cliente específico pelo ID (UUID) garantindo isolamento por empresa
  async findOne(id: string, empresaId: number = 1) {
    const cliente = await this.prisma.cliente.findFirst({
      where: {
        id,
        empresaId,
      } as any,
      include: {
        fiados: {
          take: 5, // Traz os últimos 5 lançamentos do histórico de fiado do cliente
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    // Se o cliente não for localizado, lança erro 404
    if (!cliente) {
      throw new NotFoundException(`Cliente com o ID ${id} não foi encontrado nesta empresa.`);
    }

    return cliente;
  }

  // Atualiza as informações cadastrais, limite de crédito ou saldo do cliente
  async update(id: string, updateClienteDto: UpdateClienteDto, empresaId: number = 1) {
    // Garante que o cliente existe na base da empresa antes de atualizar
    await this.findOne(id, empresaId);

    return this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
  }

  // Remove o cadastro de um cliente
  async remove(id: string, empresaId: number = 1) {
    // Garante que o cliente existe na base da empresa antes de deletar
    await this.findOne(id, empresaId);

    return this.prisma.cliente.delete({
      where: { id },
    });
  }
}