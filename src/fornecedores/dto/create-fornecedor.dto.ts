import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFornecedorDto {
  // Razão Social oficial do fornecedor - Ajustado para corresponder ao schema.prisma
  @IsString({ message: 'A razão social deve ser um texto.' })
  @IsNotEmpty({ message: 'A razão social é obrigatória.' })
  razaoSocial: string;

  // Nome Fantasia comercial - Opcional
  @IsString({ message: 'O nome fantasia deve ser um texto.' })
  @IsOptional()
  nomeFantasia?: string;

  // CNPJ único do fornecedor - Campo Obrigatório
  @IsString({ message: 'O CNPJ deve ser um texto.' })
  @IsNotEmpty({ message: 'O CNPJ é obrigatório.' })
  cnpj: string;

  // Inscrição Estadual (IE) - Opcional
  @IsString({ message: 'A inscrição estadual deve ser um texto.' })
  @IsOptional()
  inscricaoEstadual?: string;

  // Telefone / WhatsApp - Opcional
  @IsString({ message: 'O telefone deve ser um texto.' })
  @IsOptional()
  telefone?: string;

  // E-mail comercial - Opcional
  @IsEmail({}, { message: 'Forneça um e-mail válido.' })
  @IsOptional()
  email?: string;

  // Endereço completo - Opcional
  @IsString({ message: 'O endereço deve ser um texto.' })
  @IsOptional()
  endereco?: string;
}