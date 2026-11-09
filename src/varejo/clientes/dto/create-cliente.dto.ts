// Importamos os validadores do class-validator para garantir a consistência dos dados do cliente
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateClienteDto {
  // Nome completo ou Razão Social do cliente - Campo Obrigatório
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome do cliente é obrigatório.' })
  nome: string;

  // CPF (Pessoa Física) ou CNPJ (Pessoa Jurídica) - Opcional
  @IsString({ message: 'O CPF/CNPJ deve ser um texto.' })
  @IsOptional()
  cpfCnpj?: string;

  // Telefone / WhatsApp para contato e avisos de fiado - Opcional
  @IsString({ message: 'O telefone deve ser um texto.' })
  @IsOptional()
  telefone?: string;

  // Endereço de entrega padrão - Opcional
  @IsString({ message: 'O endereço deve ser um texto.' })
  @IsOptional()
  endereco?: string;

  // Valor máximo permitido para compras no fiado/crédito - Opcional (Default no banco é 0.00)
  @IsNumber({}, { message: 'O limite de crédito deve ser um valor numérico.' })
  @IsOptional()
  limiteCredito?: number;

  // O saldo devedor e os cascos em posse são calculados pelos módulos
  // FIADOS e VASILHAMES. Nunca aceitar esses saldos pelo cadastro comum.

}
