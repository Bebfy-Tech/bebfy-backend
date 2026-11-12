import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, IsNotEmpty } from 'class-validator';

export class ConfigurarAcessoDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  senha: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  codigo?: number;

  @IsArray()
  @IsString({ each: true })
  permissoes: string[];
}
