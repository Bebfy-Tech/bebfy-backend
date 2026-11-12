import { IsString, Matches, IsNotEmpty } from 'class-validator';

export class SolicitarRecuperacaoSenhaDto {
  @IsString()
  @Matches(/^\d{1,11}$/, { message: 'Informe o código numérico ou CPF do usuário.' })
  login: string;
}
export class ConfirmarRecuperacaoSenhaDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Token de recuperação inválido.' })
  token: string;
  @IsString() @IsNotEmpty()
  novaSenha: string;
  @IsString()
  confirmarNovaSenha: string;
}
