import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@ApiTags('Clientes & Fiados')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  private exigirGestor(req: any) {
    if (!['PROPRIETARIO', 'ADMINISTRADOR', 'GERENTE'].includes(req.user?.cargo)) {
      throw new ForbiddenException('Alteração de limite de crédito e exclusão restritas a gestores.');
    }
  }

  @ApiOperation({
    summary: 'Cadastrar novo cliente',
    description: 'Regista um novo cliente com limite de crédito e controlo de vasilhames em posse.',
  })
  @ApiResponse({ status: 201, description: 'Cliente criado com sucesso.' })
  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createClienteDto: CreateClienteDto,
    @Req() req: any,
  ) {
    if (createClienteDto.limiteCredito !== undefined) this.exigirGestor(req);
    return this.clientesService.create(empresaId, createClienteDto);
  }

  @ApiOperation({
    summary: 'Listar todos os clientes',
    description: 'Retorna a lista de clientes vinculados à empresa ativa.',
  })
  @ApiResponse({ status: 200, description: 'Lista de clientes retornada com sucesso.' })
  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.clientesService.findAll(empresaId);
  }

  @ApiOperation({
    summary: 'Buscar cliente por ID',
    description: 'Retorna os detalhes cadastrais e financeiros de um cliente.',
  })
  @ApiParam({ name: 'id', description: 'ID do cliente' })
  @ApiResponse({ status: 200, description: 'Cliente encontrado.' })
  @ApiResponse({ status: 404, description: 'Cliente não encontrado.' })
  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
  ) {
    return this.clientesService.findOne(empresaId, id);
  }

  @ApiOperation({
    summary: 'Atualizar dados do cliente',
    description: 'Altera os dados do cliente, limite de crédito ou endereço.',
  })
  @ApiParam({ name: 'id', description: 'ID do cliente' })
  @ApiResponse({ status: 200, description: 'Cliente atualizado com sucesso.' })
  @Patch(':id')
  update(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Body() updateClienteDto: UpdateClienteDto,
    @Req() req: any,
  ) {
    if (updateClienteDto.limiteCredito !== undefined) this.exigirGestor(req);
    return this.clientesService.update(empresaId, id, updateClienteDto);
  }

  @ApiOperation({
    summary: 'Remover cliente',
    description: 'Exclui o cadastro de um cliente.',
  })
  @ApiParam({ name: 'id', description: 'ID do cliente' })
  @ApiResponse({ status: 200, description: 'Cliente removido com sucesso.' })
  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    this.exigirGestor(req);
    return this.clientesService.remove(empresaId, id);
  }
}