import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class ConfigurarAcessoDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(10)
  senha: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  codigo?: number;

  @IsArray()
  @IsString({ each: true })
  permissoes: string[];
}
