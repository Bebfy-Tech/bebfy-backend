import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength, IsInt, Min, Max, IsIn, IsUUID, Matches, IsEnum } from 'class-validator';
import { FormaBaixaFinanceira } from '@prisma/client';
export class CriarContaDto {
 @IsString() @IsNotEmpty() @MaxLength(240) descricao:string;
 @IsNumber({maxDecimalPlaces:2}) @IsPositive() @Max(999999999) valor:number;
 @IsDateString({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) dataVencimento:string;
 @IsOptional() @IsString() @MaxLength(80) categoria?:string;
 @IsOptional() @IsString() categoriaCadastroId?:string;
 @IsOptional() @IsString() @MaxLength(500) observacao?:string;
 @IsOptional() @IsString() fornecedorId?:string;
 @IsOptional() @IsString() clienteId?:string;
 @IsOptional() @IsIn(['UNICA','PARCELADA','RECORRENTE']) modalidade?:'UNICA'|'PARCELADA'|'RECORRENTE';
 @IsOptional() @IsInt() @Min(1) @Max(60) parcelas?:number;
 @IsOptional() @IsUUID('4') chaveLancamento?:string;
}
export class BaixarContaDto {
 @IsNumber({maxDecimalPlaces:2}) @IsPositive() @Max(999999999) principal:number;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(999999999) juros?:number;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(999999999) multa?:number;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(999999999) desconto?:number;
 @IsEnum(FormaBaixaFinanceira) forma:FormaBaixaFinanceira;
 @IsOptional() @IsString() formaCadastroId?:string;
 @IsOptional() @IsString() contaFinanceiraId?:string;
 @IsOptional() @IsString() @MaxLength(500) observacao?:string;
 @IsUUID('4') chaveOperacao:string;
}
export class EstornarContaDto { @IsString() @IsNotEmpty() @MaxLength(500) motivo:string; }
