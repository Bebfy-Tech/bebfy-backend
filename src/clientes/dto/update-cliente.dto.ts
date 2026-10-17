// Importamos PartialType para reaproveitar todos os campos do CreateClienteDto como opcionais na atualização
import { PartialType } from '@nestjs/mapped-types';
import { CreateClienteDto } from './create-cliente.dto';

export class UpdateClienteDto extends PartialType(CreateClienteDto) {}