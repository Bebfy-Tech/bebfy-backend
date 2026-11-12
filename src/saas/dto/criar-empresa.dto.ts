import { IsEmail, IsInt, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class CriarEmpresaDto {
  @IsString({ message: 'O nome da empresa deve ser um texto.' })
  @IsNotEmpty({ message: 'O nome da empresa é obrigatório.' })
  nome: string;

  @IsString({ message: 'O documento (CPF ou CNPJ) deve ser um texto.' })
  @IsNotEmpty({ message: 'O documento (CNPJ) é obrigatório.' })
  documento: string;

  @IsString({ message: 'O subdomínio deve ser um texto.' })
  @IsNotEmpty({ message: 'O subdomínio é obrigatório.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Subdomínio deve conter letras minúsculas, números ou hífens internos.' })
  subdominio: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório.' })
  email: string;

  @IsString({ message: 'O telefone deve ser um texto.' })
  @IsNotEmpty({ message: 'O telefone é obrigatório.' })
  telefone: string;

  @IsInt({ message: 'O ID do plano deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID do plano inicial é obrigatório.' })
  planoId: number;

  @IsString()
  @IsNotEmpty()
  nomeResponsavel: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF do responsável deve conter 11 dígitos.' })
  cpfResponsavel: string;

  @IsString()
  @MinLength(10)
  senhaInicial: string;
}