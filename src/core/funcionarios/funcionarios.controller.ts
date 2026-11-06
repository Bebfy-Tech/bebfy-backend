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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FuncionariosService } from './funcionarios.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Gestão & Equipa')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('funcionarios')
export class FuncionariosController {
  constructor(private readonly funcionariosService: FuncionariosService) {}

  @ApiOperation({
    summary: 'Cadastrar novo funcionário',
    description: 'Regista um novo colaborador na equipa.',
  })
  @ApiResponse({ status: 201, description: 'Funcionário cadastrado com sucesso.' })
  @Post()
  create(@Body() createFuncionarioDto: CreateFuncionarioDto) {
    return this.funcionariosService.create(createFuncionarioDto);
  }

  @ApiOperation({
    summary: 'Listar todos os funcionários',
    description: 'Retorna a lista completa de funcionários.',
  })
  @ApiResponse({ status: 200, description: 'Lista de funcionários retornada.' })
  @Get()
  findAll() {
    return this.funcionariosService.findAll();
  }

  @ApiOperation({
    summary: 'Buscar funcionário por ID',
    description: 'Retorna os detalhes de um funcionário específico.',
  })
  @ApiParam({ name: 'id', description: 'ID do funcionário' })
  @ApiResponse({ status: 200, description: 'Funcionário encontrado.' })
  @ApiResponse({ status: 404, description: 'Funcionário não encontrado.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.funcionariosService.findOne(id);
  }

  @ApiOperation({
    summary: 'Atualizar dados de um funcionário',
    description: 'Altera os dados cadastrais ou permissões de um funcionário.',
  })
  @ApiParam({ name: 'id', description: 'ID do funcionário' })
  @ApiResponse({ status: 200, description: 'Funcionário atualizado com sucesso.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFuncionarioDto: UpdateFuncionarioDto,
  ) {
    return this.funcionariosService.update(id, updateFuncionarioDto);
  }

  @ApiOperation({
    summary: 'Remover funcionário',
    description: 'Exclui o registo de um funcionário.',
  })
  @ApiParam({ name: 'id', description: 'ID do funcionário' })
  @ApiResponse({ status: 200, description: 'Funcionário removido com sucesso.' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.funcionariosService.remove(id);
  }
}