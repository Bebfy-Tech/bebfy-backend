// Importamos os decoradores HTTP do NestJS e a proteção por Guard JWT
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
// Importamos o Guard de autenticação JWT
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';

// Exige token JWT autenticado para acessar qualquer rota de clientes
@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // POST /clientes -> Cadastra um novo cliente
  @Post()
  create(@Body() createClienteDto: CreateClienteDto) {
    return this.clientesService.create(createClienteDto);
  }

  // GET /clientes -> Retorna a lista de todos os clientes
  @Get()
  findAll() {
    return this.clientesService.findAll();
  }

  // GET /clientes/:id -> Busca os dados de um cliente pelo ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  // PATCH /clientes/:id -> Atualiza os dados de um cliente existente
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClienteDto: UpdateClienteDto) {
    return this.clientesService.update(id, updateClienteDto);
  }

  // DELETE /clientes/:id -> Exclui o cadastro de um cliente
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }
}
