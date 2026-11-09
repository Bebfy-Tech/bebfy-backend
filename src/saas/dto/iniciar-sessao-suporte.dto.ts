import { Equals, IsBoolean, IsInt, IsNotEmpty, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class IniciarSessaoSuporteDto {
  @IsInt()
  @Min(1)
  empresaId: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(500)
  motivo: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  ticket: string;

  @IsBoolean()
  @Equals(true, { message: 'Confirme a autorização do cliente para esta sessão de suporte.' })
  consentimentoConfirmado: boolean;
}
