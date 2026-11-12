import { IsString, MaxLength, MinLength } from 'class-validator';

export class PersonalizarModuloDto {
  @IsString() @MinLength(2) @MaxLength(90) nome: string;
  @IsString() @MinLength(2) @MaxLength(240) descricao: string;
}
