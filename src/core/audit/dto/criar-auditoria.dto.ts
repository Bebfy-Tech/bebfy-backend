import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class CriarAuditoriaDto {
  @IsInt({ message: 'O ID da empresa deve ser um número inteiro.' })
  @IsNotEmpty({ message: 'O ID da empresa é obrigatório.' })
  empresaId: number;

  @IsString({ message: 'O ID do usuário deve ser um texto.' })
  @IsOptional()
  usuarioId?: string;

  @IsString({ message: 'A ação deve ser um texto.' })
  @IsNotEmpty({ message: 'A ação de auditoria é obrigatória.' })
  acao: string;

  @IsString({ message: 'A entidade deve ser um texto.' })
  @IsNotEmpty({ message: 'A entidade afetada é obrigatória.' })
  entidade: string;

  @IsString({ message: 'O ID da entidade deve ser um texto.' })
  @IsOptional()
  entidadeId?: string;

  @IsString({ message: 'Os detalhes devem ser um texto.' })
  @IsOptional()
  detalhes?: string;

  @IsString({ message: 'O IP deve ser um texto.' })
  @IsOptional()
  ip?: string;
}