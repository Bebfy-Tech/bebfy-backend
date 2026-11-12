import { IsString, IsNotEmpty } from 'class-validator';

export class AlterarSenhaDto {
  @IsString()
  senhaAtual: string;

  @IsString()
  @IsNotEmpty()
  novaSenha: string;

  @IsString()
  confirmarNovaSenha: string;
}
