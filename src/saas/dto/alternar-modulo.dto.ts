import { IsBoolean, IsEnum, IsNotEmpty } from 'class-validator';
import { NomeModulo } from '@prisma/client';

export class AlternarModuloDto {
  @IsEnum(NomeModulo, { message: 'Nome do módulo inválido.' })
  @IsNotEmpty({ message: 'O nome do módulo é obrigatório.' })
  modulo: NomeModulo;

  @IsBoolean({ message: 'O campo ativo deve ser verdadeiro ou falso.' })
  @IsNotEmpty({ message: 'O estado de ativação é obrigatório.' })
  ativo: boolean;
}