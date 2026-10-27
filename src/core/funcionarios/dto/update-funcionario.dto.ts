// Importamos PartialType para transformar os campos do CreateFuncionarioDto em opcioaniss
import { PartialType } from '@nestjs/mapped-types';
import { CreateFuncionarioDto } from './create-funcionario.dto';

export class UpdateFuncionarioDto extends PartialType(CreateFuncionarioDto) {}
