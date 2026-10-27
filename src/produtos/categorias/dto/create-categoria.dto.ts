import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome da categoria é obrigatório.' })
  nome: string;

  @IsString()
  @IsOptional()
  descricao?: string;
}
