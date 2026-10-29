import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ValidarGerenteDto {
  @IsString({ message: 'O login do gerente deve ser um texto.' })
  @Matches(/^[0-9]+$/, { message: 'O login do gerente deve conter apenas números.' })
  @IsNotEmpty({ message: 'O login do gerente é obrigatório.' })
  login: string;

  @IsString({ message: 'A senha deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  senha: string;
}