// Importamos os validadores do class-validator
import { IsNotEmpty, IsNumber } from 'class-validator';

export class FecharCaixaDto {
  // Valor total em dinheiro físico contado no gaveteiro ao fechar - Campo Obrigatório
  @IsNumber({}, { message: 'O saldo final físico deve ser um valor numérico.' })
  @IsNotEmpty({ message: 'O saldo final físico é obrigatório.' })
  saldoFinalFisico: number;
}
