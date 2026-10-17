import { Injectable } from '@nestjs/common';
import { CreateFornecedoreDto } from './dto/create-fornecedore.dto';
import { UpdateFornecedoreDto } from './dto/update-fornecedore.dto';

@Injectable()
export class FornecedoresService {
  create(createFornecedoreDto: CreateFornecedoreDto) {
    return 'This action adds a new fornecedore';
  }

  findAll() {
    return `This action returns all fornecedores`;
  }

  findOne(id: number) {
    return `This action returns a #${id} fornecedore`;
  }

  update(id: number, updateFornecedoreDto: UpdateFornecedoreDto) {
    return `This action updates a #${id} fornecedore`;
  }

  remove(id: number) {
    return `This action removes a #${id} fornecedore`;
  }
}
