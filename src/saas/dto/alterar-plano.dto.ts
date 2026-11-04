import { IsInt, IsNotEmpty } from 'class-validator';

export class AlterarPlanoDto {
  @IsInt({ message: 'O ID do plano deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID do plano é obrigatório.' })
  planoId: number;
}