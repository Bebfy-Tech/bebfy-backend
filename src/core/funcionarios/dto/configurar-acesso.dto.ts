import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min, IsNotEmpty, ArrayMaxSize, MaxLength, MinLength, Max } from 'class-validator';

export class ConfigurarAcessoDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(72)
  senha: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  codigo?: number;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  permissoes: string[];
}
