import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'O login deve ser um texto.' })
  @Matches(/^[0-9]+$/, { message: 'O login deve conter apenas números (CPF ou código do funcionário).' })
  @IsNotEmpty({ message: 'O login numérico é obrigatório.' })
  login: string;

  @IsString({ message: 'A senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  senha: string;
}