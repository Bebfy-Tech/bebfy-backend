import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AtualizarEmpresaSaasDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150)
  nomeFantasia?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(200)
  razaoSocial?: string;

  @IsOptional() @IsString()
  @Matches(/^(?:\d{11}|\d{14})$/, { message: 'Informe CPF de 11 dígitos ou CNPJ de 14 dígitos.' })
  documento?: string;

  @IsOptional() @IsString() @Matches(/^\d{10,11}$/, {message:'Telefone com DDD deve ter 10 ou 11 dígitos.'})
  telefone?: string;

  @IsOptional() @IsEmail()
  emailResponsavel?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(150)
  nomeResponsavel?: string;

  @IsOptional() @IsString() @Matches(/^\d{11}$/)
  cpfResponsavel?: string;

  // Admin-initiated reset revokes active sessions and forces a new password at next login.
  @IsOptional() @IsString() @MinLength(10)
  senhaTemporaria?: string;
}
