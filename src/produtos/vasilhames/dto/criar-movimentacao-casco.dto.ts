import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength, IsUUID } from 'class-validator';
enum TipoMovimentacaoCascoDto { EMPRESTIMO_SAIDA='EMPRESTIMO_SAIDA', DEVOLUCAO_ENTRADA='DEVOLUCAO_ENTRADA', QUEBRA_AVARIA='QUEBRA_AVARIA', CLASSIFICACAO='CLASSIFICACAO' }
export class CriarMovimentacaoCascoDto {
 @IsString() @IsNotEmpty() clienteId:string;
 @IsOptional() @IsInt() @Min(1) produtoId?:number;
 @IsOptional() @IsInt() @Min(1) tipoVasilhameId?:number|null;
 @IsInt() @Min(1) quantidade:number;
 @IsEnum(TipoMovimentacaoCascoDto) tipo:TipoMovimentacaoCascoDto;
 @IsOptional() @IsString() @MaxLength(500) observacao?:string;
 @IsOptional() @IsUUID('4') chaveOperacao?:string;
}
