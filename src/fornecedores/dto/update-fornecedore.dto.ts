import { PartialType } from '@nestjs/mapped-types';
import { CreateFornecedoreDto } from './create-fornecedore.dto';

export class UpdateFornecedoreDto extends PartialType(CreateFornecedoreDto) {}
