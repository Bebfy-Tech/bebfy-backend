import { IsBoolean, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class DefinirInadimplenciaDto {
  @IsBoolean()
  inadimplente: boolean;
}

export class LiberarAcessoTemporarioDto {
  @IsInt() @Min(1) @Max(90)
  dias: number;

  @IsString() @MinLength(8) @MaxLength(500)
  motivo: string;
}
