import { IsInt, IsNotEmpty, IsNumber } from 'class-validator';

export class CreateItemVendaDto {
  @IsInt({ message: 'O ID do produto deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID do produto é obrigatório.' })
  produtoId: number;

  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'A quantidade é obrigatória.' })
  quantidade: number;

  @IsNumber({}, { message: 'O preço unitário deve ser um número.' })
  @IsNotEmpty({ message: 'O preço unitário é obrigatório.' })
  precoUnitario: number;
}
