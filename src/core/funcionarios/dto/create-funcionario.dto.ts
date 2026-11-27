// Importamos os validadores do class-validator e o Enum de cargos gerado pelo Prisma
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Cargo } from '@prisma/client';

export class CreateFuncionarioDto {
  // Nome completo do funcionário - Campo Obrigatório
  @IsString({ message: 'O nome deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome do funcionário é obrigatório.' })
  @MaxLength(200)
  nome: string;

  // CPF único do colaborador - Campo Obrigatório
  @IsString({ message: 'O CPF deve ser um texto.' })
  @IsNotEmpty({ message: 'O CPF é obrigatório.' })
  @MaxLength(20)
  cpf: string;

  // Telefone/WhatsApp de contacto - Opcional
  @IsString({ message: 'O telefone deve ser um texto.' })
  @IsOptional()
  telefone?: string;

  // Cargo desempenhado na distribuidora (ex: GERENTE, OPERADOR_CAIXA, ENTREGADOR) - Obrigatório
  @IsEnum(Cargo, { message: 'Selecione um cargo válido.' })
  @IsNotEmpty({ message: 'O cargo é obrigatório.' })
  cargo: Cargo;

  // Percentual ou valor de desconto máximo que este funcionário pode conceder na venda - Opcional
  @IsNumber({}, { message: 'O desconto máximo deve ser um valor numérico.' })
  @IsOptional()
  @Min(0)
  @Max(100)
  descontoMaximo?: number;

  // Define se o funcionário está ativo ou inativo na empresa - Opcional (Default: true)
  @IsBoolean({ message: 'O status ativo deve ser verdadeiro ou falso.' })
  @IsOptional()
  ativo?: boolean;
}
