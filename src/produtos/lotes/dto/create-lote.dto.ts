import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLoteDto {
  // O produtoId agora é validado como número inteiro (ex: 1, 2, 3)
  @IsInt({ message: 'O ID do produto deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID do produto é obrigatório.' })
  produtoId: number;

  @IsInt({ message: 'A quantidade deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'A quantidade do lote é obrigatória.' })
  quantidade: number;

  @IsString({ message: 'O número do lote deve ser um texto.' })
  @IsOptional()
  numeroLote?: string;

  @IsDateString({}, { message: 'A data de vencimento deve ser uma data válida no formato YYYY-MM-DD.' })
  @IsOptional()
  dataVencimento?: string;
}
