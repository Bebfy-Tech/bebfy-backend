// Importamos os decoradores HTTP do NestJS e as proteções de segurança
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
// Importamos o serviço de clientes
import { ClientesService } from './clientes.service';
// Importamos os DTOs
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
// Importamos os Guards de autenticação e isolamento por empresa
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

// Exige token JWT autenticado e validação de empresa para acessar qualquer rota de clientes
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // POST /clientes -> Cadastra um novo cliente com injeção segura de empresaId
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createClienteDto: CreateClienteDto,
  ) {
    return this.clientesService.create(empresaId, createClienteDto);
  }

  // GET /clientes -> Retorna a lista de todos os clientes da empresa
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.clientesService.findAll(empresaId);
  }

  // GET /clientes/:id -> Busca os dados de um cliente pelo ID
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.clientesService.findOne(empresaId, id);
  }

  // PATCH /clientes/:id -> Atualiza os dados de um cliente existente
  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.update(empresaId, id, updateClienteDto);
  }

  // DELETE /clientes/:id -> Exclui o cadastro de um cliente
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.clientesService.remove(empresaId, id);
  }
}