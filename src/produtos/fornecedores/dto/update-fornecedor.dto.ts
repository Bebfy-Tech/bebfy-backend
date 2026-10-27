// Importamos PartialType para transformar todas as propriedades do CreateFornecedorDto em opcionais
import { PartialType } from '@nestjs/mapped-types';
import { CreateFornecedorDto } from './create-fornecedor.dto';

export class UpdateFornecedorDto extends PartialType(CreateFornecedorDto) {}
