import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, Min, MaxLength } from 'class-validator';
import { TipoPessoa } from '@prisma/client';
export class CreateClienteDto {
 @IsString() @IsNotEmpty() @MaxLength(200) nome:string;
 @IsOptional() @IsString() @MaxLength(30) cpfCnpj?:string|null;
 @IsOptional() @IsEnum(TipoPessoa) tipoPessoa?:TipoPessoa;
 @IsOptional() @IsString() @MaxLength(30) telefone?:string|null;
 @IsOptional() @IsString() @MaxLength(500) endereco?:string|null;
 @IsOptional() @IsString() @MaxLength(2000) observacao?:string|null;
 @IsOptional() @IsNumber({maxDecimalPlaces:2}) @Min(0) limiteCredito?:number;
 // Calculated balances and activation never enter the ordinary DTO.
}
