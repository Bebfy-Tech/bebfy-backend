import { PartialType } from '@nestjs/mapped-types';
import { CreateProdutoDto } from './create-produto.dto';

// Herda todos os campos do CreateProdutoDto, tornando-os opcionais para atualização
export class UpdateProdutoDto extends PartialType(CreateProdutoDto) {}