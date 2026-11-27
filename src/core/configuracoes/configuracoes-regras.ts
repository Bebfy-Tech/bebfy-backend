import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import { validarDocumento } from '../../varejo/clientes/documento';

// Apenas campos comerciais permitidos; plano, CNPJ, nome oficial e slug pertencem ao SaaS.
export const configuracaoSchema=z.object({
 telefone:z.string().trim().max(20).refine(v=>!v||/^\d{10,11}$/.test(v),'Telefone deve conter DDD e 8 ou 9 dígitos.'),
 endereco:z.string().trim().max(300),
 mensagemComprovante:z.string().trim().max(240),
 obrigarCpfClienteVenda:z.boolean(),
 revisao:z.string().datetime().nullable(),
}).strict();
export type ConfiguracaoDto=z.infer<typeof configuracaoSchema>;
export function podeEditarConfiguracao(cargo:string|undefined){return cargo==='PROPRIETARIO'||cargo==='ADMINISTRADOR';}
export function exigirEditor(cargo:string|undefined){if(!podeEditarConfiguracao(cargo))throw new ForbiddenException('Apenas proprietário ou administrador pode alterar configurações da distribuidora.');}
export function exigirDocumentoVenda(obrigatorio:boolean,documento:string|null|undefined){
 if(!obrigatorio)return;
 if(!validarDocumento(documento))throw new BadRequestException('A empresa exige cliente identificado com CPF ou CNPJ válido para concluir a venda.');
}
