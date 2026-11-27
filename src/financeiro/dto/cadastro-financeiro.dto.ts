import { IsEnum, IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean, IsInt, Min, Max, IsNumber, IsArray, ArrayMaxSize, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoCadastroFinanceiro, FormaBaixaFinanceira } from '@prisma/client';
export class TaxaParcelaDto{
 @IsInt() @Min(1) @Max(24) parcelas:number;
 @IsNumber({maxDecimalPlaces:4}) @Min(0) @Max(100) taxa:number;
 @IsInt() @Min(0) @Max(365) prazoDias:number;
}
export class CadastroFinanceiroDto{
 @IsEnum(TipoCadastroFinanceiro) tipo:TipoCadastroFinanceiro;
 @IsString() @IsNotEmpty() @MaxLength(120) nome:string;
 @IsOptional() @IsBoolean() ativo?:boolean;
 @IsOptional() @IsEnum(FormaBaixaFinanceira) formaBase?:FormaBaixaFinanceira|null;
 @IsOptional() @IsBoolean() fiado?:boolean;
 @IsOptional() @IsBoolean() permitePagar?:boolean;
 @IsOptional() @IsBoolean() permiteReceber?:boolean;
 @IsOptional() @IsBoolean() permitePdv?:boolean;
 @IsOptional() @IsInt() @Min(1) @Max(24) maxParcelas?:number;
 @IsOptional() @IsArray() @ArrayMaxSize(24) @ValidateNested({each:true}) @Type(()=>TaxaParcelaDto) taxas?:TaxaParcelaDto[];
 @IsOptional() @IsString() bancoId?:string|null;
 @IsOptional() @IsString() contaId?:string|null;
 @IsOptional() @IsString() operadoraId?:string|null;
 @IsOptional() @IsString() @MaxLength(30) agencia?:string|null;
 @IsOptional() @IsString() @MaxLength(50) numeroConta?:string|null;
 @IsOptional() @IsIn(['CORRENTE','POUPANCA','DIGITAL','CAIXA_FISICO']) tipoConta?:string|null;
 @IsOptional() @IsString() @MaxLength(150) chavePix?:string|null;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(-999999999) @Max(999999999) saldoInicial?:number;
}
export class SituacaoCadastroDto{@IsBoolean() ativo:boolean;}
