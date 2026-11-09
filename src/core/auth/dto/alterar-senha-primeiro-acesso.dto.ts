import { IsString, MinLength } from 'class-validator';

export class AlterarSenhaPrimeiroAcessoDto {
  @IsString()
  tokenTroca: string;

  @IsString()
  senhaAtual: string;

  @IsString()
  @MinLength(10)
  novaSenha: string;

  @IsString()
  confirmarNovaSenha: string;
}
