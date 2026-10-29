import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class PagarFiadoDto {
  @IsNumber({}, { message: 'O valor do pagamento deve ser um número.' })
  @IsPositive({ message: 'O valor do pagamento deve ser maior que zero.' })
  valor: number;

  @IsString({ message: 'A forma de pagamento deve ser um texto.' })
  formaPagamento: string;

  @IsOptional()
  @IsString({ message: 'O ID do caixa deve ser um texto/UUID.' })
  caixaId?: string;
}