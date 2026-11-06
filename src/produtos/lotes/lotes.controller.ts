import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LotesService } from './lotes.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Post()
  create(
    @CurrentTenant() empresaId: number,
    @Body() createLoteDto: CreateLoteDto,
  ) {
    return this.lotesService.create(empresaId, createLoteDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: number) {
    return this.lotesService.findAll(empresaId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.lotesService.findOne(empresaId, id);
  }

  @Delete(':id')
  remove(
    @CurrentTenant() empresaId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.lotesService.remove(empresaId, id);
  }
}