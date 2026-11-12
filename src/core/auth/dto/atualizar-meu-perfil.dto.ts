import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AtualizarMeuPerfilDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150)
  nome?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone com DDD precisa de 10 ou 11 dígitos.' })
  telefone?: string;
}
