import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';
import { CreateFornecedoreDto } from './dto/create-fornecedore.dto';
import { UpdateFornecedoreDto } from './dto/update-fornecedore.dto';

@Controller('fornecedores')
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Post()
  create(@Body() createFornecedoreDto: CreateFornecedoreDto) {
    return this.fornecedoresService.create(createFornecedoreDto);
  }

  @Get()
  findAll() {
    return this.fornecedoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.fornecedoresService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFornecedoreDto: UpdateFornecedoreDto) {
    return this.fornecedoresService.update(+id, updateFornecedoreDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.fornecedoresService.remove(+id);
  }
}
