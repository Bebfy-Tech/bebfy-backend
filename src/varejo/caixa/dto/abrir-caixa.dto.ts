// Importamos os validadores do class-validator
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class AbrirCaixaDto {
  // ID do funcionário/operador que está abrindo o caixa - Campo Obrigatório
  @IsString({ message: 'O ID do operador deve ser um texto/UUID válido.' })
  @IsNotEmpty({ message: 'O ID do operador é obrigatório.' })
  operadorId: string;

  // Valor em dinheiro inserido no caixa como troco inicial - Campo Obrigatório
  @IsNumber({maxDecimalPlaces:2}, { message: 'O saldo inicial deve ser um valor numérico.' })
  @IsNotEmpty({ message: 'O saldo inicial é obrigatório.' })
  @Min(0)
  saldoInicial: number;
}
