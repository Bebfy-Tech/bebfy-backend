import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** JPEG compactado pelo cliente; o limite mantém a requisição abaixo de 100 KB. */
export class ProdutoFotoDto {
  @IsString()
  @MinLength(8)
  @MaxLength(87384)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  base64!: string;
}
