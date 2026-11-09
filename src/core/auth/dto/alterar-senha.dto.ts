import { IsString, MinLength } from 'class-validator';

export class AlterarSenhaDto {
  @IsString()
  senhaAtual: string;

  @IsString()
  @MinLength(10)
  novaSenha: string;

  @IsString()
  confirmarNovaSenha: string;
}
