import { PartialType } from '@nestjs/mapped-types';
import { CreateFiadoDto } from './create-fiado.dto';

export class UpdateFiadoDto extends PartialType(CreateFiadoDto) {}
