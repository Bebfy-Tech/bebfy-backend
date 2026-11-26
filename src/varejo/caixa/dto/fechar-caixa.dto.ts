import { IsNumber, IsOptional, Min } from 'class-validator';

export class FecharCaixaDto {
  // Optional physical count. Absence is recorded as null, never a fictitious reconciliation.
  @IsOptional()
  @IsNumber({}, { message: 'O saldo final físico deve ser um valor numérico.' })
  @Min(0)
  saldoFinalFisico?: number;
}
