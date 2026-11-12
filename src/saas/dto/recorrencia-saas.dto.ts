import { IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class ConfigurarRecorrenciaSaasDto {
  @IsBoolean() recorrente: boolean;
  @Type(()=>Number) @IsInt() @Min(1) @Max(28) diaVencimento: number;
}
export class GerarMensalidadesSaasDto {
  @IsString() @Matches(/^20\\d{2}-(0[1-9]|1[0-2])$/) competencia: string;
}
