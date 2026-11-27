import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString, IsUUID, Max, MaxLength } from 'class-validator';
class MovimentoDto{
 @IsNumber({maxDecimalPlaces:2}) @IsPositive() @Max(999999999) valor:number;
 @IsString() @IsNotEmpty() @MaxLength(500) observacao:string;
 @IsUUID('4') chaveOperacao:string;
}
export class TransferirDto extends MovimentoDto{
 @IsString() @IsNotEmpty() origemId:string;
 @IsString() @IsNotEmpty() destinoId:string;
}
export class ConciliarDto extends MovimentoDto{
 @IsIn(['VENDA','FIADO']) fonte:'VENDA'|'FIADO';
 @IsString() @IsNotEmpty() fonteId:string;
 @IsString() @IsNotEmpty() destinoId:string;
}
export class EstornarMovimentoDto{
 @IsString() @IsNotEmpty() @MaxLength(500) motivo:string;
 @IsUUID('4') chaveOperacao:string;
}
