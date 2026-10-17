// Importamos os decoradores HTTP do NestJS e a proteção JWT
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
import { FuncionariosService } from './funcionarios.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly funcionariosService: FuncionariosService) {}

  // POST /funcionarios -> Cadastra um novo funcionário
  @Post()
  create(@Body() createFuncionarioDto: CreateFuncionarioDto) {
    return this.funcionariosService.create(createFuncionarioDto);
  }

  // GET /funcionarios -> Retorna a lista de todos os funcionários
  @Get()
  findAll() {
    return this.funcionariosService.findAll();
  }

  // GET /funcionarios/:id -> Retorna o funcionário pelo ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.funcionariosService.findOne(id);
  }

  // PATCH /funcionarios/:id -> Atualiza os dados de um funcionário
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFuncionarioDto: UpdateFuncionarioDto,
  ) {
    return this.funcionariosService.update(id, updateFuncionarioDto);
  }

  // DELETE /funcionarios/:id -> Remove um funcionário
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.funcionariosService.remove(id);
  }
}