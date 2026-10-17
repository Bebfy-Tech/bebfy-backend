// Importamos os decoradores e exceções padrão do NestJS
import { Injectable, NotFoundException } from '@nestjs/common';
// Importamos o serviço do Prisma para executar as consultas no banco
import { PrismaService } from '../prisma/prisma.service';
// Importamos os DTOs de validação de dados
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  // Injeta o PrismaService para manipular a tabela Cliente no PostgreSQL
  constructor(private readonly prisma: PrismaService) {}

  // Registra um novo cliente no banco de dados
  async create(createClienteDto: CreateClienteDto) {
    return this.prisma.cliente.create({
      data: createClienteDto,
    });
  }

  // Lista todos os clientes cadastrados, do mais recente para o mais antigo
  async findAll() {
    return this.prisma.cliente.findMany({
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

  // Busca um cliente específico pelo ID (UUID)
  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        fiados: {
          take: 5, // Traz os últimos 5 lançamentos do histórico de fiado do cliente
          orderBy: { criadoEm: 'desc' },
        },
      },
    });

    // Se o cliente não for localizado, lança erro 404
    if (!cliente) {
      throw new NotFoundException(`Cliente com o ID ${id} não foi encontrado.`);
    }

    return cliente;
  }

  // Atualiza as informações cadastrais, limite de crédito ou saldo do cliente
  async update(id: string, updateClienteDto: UpdateClienteDto) {
    // Garante que o cliente existe na base antes de atualizar
    await this.findOne(id);

    return this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
  }

  // Remove o cadastro de um cliente
  async remove(id: string) {
    // Garante que o cliente existe antes de deletar
    await this.findOne(id);

    return this.prisma.cliente.delete({
      where: { id },
    });
  }
}