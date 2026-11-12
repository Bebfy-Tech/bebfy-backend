import { IsString, IsNotEmpty } from 'class-validator';

export class AlterarSenhaPrimeiroAcessoDto {
  @IsString()
  tokenTroca: string;

  @IsString()
  senhaAtual: string;

  @IsString()
  @IsNotEmpty()
  novaSenha: string;

  @IsString()
  confirmarNovaSenha: string;
}
