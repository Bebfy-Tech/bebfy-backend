import { IsEnum, IsNotEmpty } from 'class-validator';
import { StatusEmpresa } from '@prisma/client';

export class AlterarStatusEmpresaDto {
  @IsEnum(StatusEmpresa, { 
    message: 'Status inválido. Escolha entre: ATIVA, SUSPENSA, CANCELADA ou EM_TESTE.' 
  })
  @IsNotEmpty({ message: 'O status da empresa é obrigatório.' })
  status: StatusEmpresa;
}