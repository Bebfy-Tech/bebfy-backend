import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, IsEnum, IsOptional, MaxLength, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { StatusEntrega } from '@prisma/client';
export class AtualizarEntregaDto {
 @IsEnum(StatusEntrega) status:StatusEntrega;
 @IsOptional() @IsString() @IsNotEmpty() entregadorId?:string;
 @IsOptional() @IsString() @MaxLength(500) observacao?:string;
}
export class AcertoDeliveryDto {
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({each:true}) vendaIds:string[];
 @IsNumber({maxDecimalPlaces:2}) @Min(0) dinheiroConferido:number;
}
