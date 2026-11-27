import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TipoPessoa } from '@prisma/client';
export class CreateFornecedorDto{
 @IsString() @IsNotEmpty() @MaxLength(200) razaoSocial:string;
 // Legacy field name stores either CPF or CNPJ.
 @IsString() @IsNotEmpty() @MaxLength(30) cnpj:string;
 @IsOptional() @IsEnum(TipoPessoa) tipoPessoa?:TipoPessoa;
 @IsOptional() @IsString() @MaxLength(200) nomeFantasia?:string|null;
 @IsOptional() @IsString() @MaxLength(30) inscricaoEstadual?:string|null;
 @IsOptional() @IsString() @MaxLength(30) telefone?:string|null;
 @IsOptional() @IsEmail() @MaxLength(200) email?:string|null;
 @IsOptional() @IsString() @MaxLength(500) endereco?:string|null;
 @IsOptional() @IsString() @MaxLength(150) contatoComercial?:string|null;
 @IsOptional() @IsString() @Matches(/^\d{5}-?\d{3}$/) cep?:string|null;
 @IsOptional() @IsString() @MaxLength(120) cidade?:string|null;
 @IsOptional() @IsString() @Matches(/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/) uf?:string|null;
 @IsOptional() @IsString() @MaxLength(120) segmento?:string|null;
 @IsOptional() @IsString() @MaxLength(1000) observacao?:string|null;
 @IsOptional() @IsBoolean() ativo?:boolean;
}
