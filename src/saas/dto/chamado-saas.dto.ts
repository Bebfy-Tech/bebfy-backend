import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export const CHAMADO_STATUS = ['PENDENTE','EM_ATENDIMENTO','AGUARDANDO_CLIENTE','COM_DEV','RESOLVIDO','CANCELADO'] as const;
export const CHAMADO_PRIORIDADES = ['BAIXA','NORMAL','ALTA','URGENTE'] as const;
export const CHAMADO_CATEGORIAS = ['DUVIDA','ERRO','CONFIGURACAO','FINANCEIRO','SOLICITACAO','OUTRO'] as const;

export class CriarChamadoSaasDto {
  @Type(() => Number) @IsInt() @Min(1) empresaId: number;
  @IsString() @MinLength(3) @MaxLength(160) titulo: string;
  @IsString() @MinLength(5) @MaxLength(10000) descricao: string;
  @IsOptional() @IsString() @MaxLength(120) contatoNome?: string;
  @IsOptional() @IsString() @MaxLength(20) contatoTelefone?: string;
  @IsOptional() @IsIn(CHAMADO_CATEGORIAS) categoria?: typeof CHAMADO_CATEGORIAS[number];
  @IsOptional() @IsIn(CHAMADO_PRIORIDADES) prioridade?: typeof CHAMADO_PRIORIDADES[number];
  @IsOptional() @IsString() responsavelId?: string;
}

export class AtualizarChamadoSaasDto {
  @IsOptional() @IsIn(CHAMADO_STATUS) status?: typeof CHAMADO_STATUS[number];
  @IsOptional() @IsIn(CHAMADO_PRIORIDADES) prioridade?: typeof CHAMADO_PRIORIDADES[number];
  @IsOptional() @IsIn(CHAMADO_CATEGORIAS) categoria?: typeof CHAMADO_CATEGORIAS[number];
  @IsOptional() @IsString() @MaxLength(160) titulo?: string;
  @IsOptional() @IsString() @MaxLength(10000) descricao?: string;
  @IsOptional() @IsString() @MaxLength(120) contatoNome?: string;
  @IsOptional() @IsString() @MaxLength(20) contatoTelefone?: string;
  @IsOptional() @IsBoolean() comDev?: boolean;
  @IsOptional() @IsString() @MaxLength(120) devResponsavel?: string;
  @IsOptional() @IsString() responsavelId?: string;
  @IsOptional() @IsString() @MaxLength(5000) solucao?: string;
}

export class RegistrarInteracaoSaasDto {
  @IsString() @MinLength(2) @MaxLength(5000) mensagem: string;
}
