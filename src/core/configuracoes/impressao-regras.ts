import {z} from 'zod';
// Numeric dimensions in millimeters; no arbitrary CSS or HTML is accepted.
export const documentos=['venda','fiado','extrato','financeiro','vasilhames','entrega','relatorio','dre','caixa','compra','inventario'] as const;
export type Documento=typeof documentos[number];
export const perfilSchema=z.object({
 papel:z.enum(['58','80','A4','A5','PERSONALIZADO']),
 largura:z.number().finite().min(40).max(420),altura:z.number().finite().min(60).max(1000).nullable(),
 orientacao:z.enum(['RETRATO','PAISAGEM']),
 superior:z.number().finite().min(0).max(40),inferior:z.number().finite().min(0).max(40),esquerda:z.number().finite().min(0).max(40),direita:z.number().finite().min(0).max(40),
 fonte:z.enum(['Arial','monospace']),tamanho:z.number().int().min(8).max(18),
 endereco:z.boolean(),operador:z.boolean(),rodape:z.boolean(),
}).strict().superRefine((p,ctx)=>{
 const dimensions:Record<string,[number,number|null]>={'58':[58,null],'80':[80,null],A4:[210,297],A5:[148,210]};
 const fixed=dimensions[p.papel];
 if(fixed&&(p.largura!==fixed[0]||p.altura!==fixed[1]))ctx.addIssue({code:'custom',message:'Dimensões incompatíveis com o formato escolhido.'});
 if(p.altura===null&&p.orientacao==='PAISAGEM')ctx.addIssue({code:'custom',message:'Papel contínuo requer orientação retrato.'});
 const w=p.orientacao==='PAISAGEM'?p.altura!:p.largura,h=p.orientacao==='PAISAGEM'?p.largura:p.altura;
 if(w-p.esquerda-p.direita<25||h!==null&&h-p.superior-p.inferior<30)ctx.addIssue({code:'custom',message:'Margens deixam área de impressão insuficiente.'});
});
export type Perfil=z.infer<typeof perfilSchema>;
const campos=Object.fromEntries(documentos.map(k=>[k,perfilSchema])) as Record<Documento,typeof perfilSchema>;
export const perfisSchema=z.object(campos).strict();
export const impressaoSchema=z.object({perfis:perfisSchema,revisao:z.string().datetime().nullable()}).strict();
export type ImpressaoDto=z.infer<typeof impressaoSchema>;
export function padrao(d:Documento):Perfil{
 const termico=['venda','fiado','entrega','caixa'].includes(d);
 return {papel:termico?'80':'A4',largura:termico?80:210,altura:termico?null:297,orientacao:d==='relatorio'?'PAISAGEM':'RETRATO',superior:termico?3:10,inferior:termico?3:10,esquerda:termico?3:10,direita:termico?3:10,fonte:termico?'monospace':'Arial',tamanho:termico?10:11,endereco:true,operador:true,rodape:true};
}
export function perfisValidos(raw:unknown):Record<Documento,Perfil>{
 const obj=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 return Object.fromEntries(documentos.map(d=>{const parsed=perfilSchema.safeParse(obj[d]);return [d,parsed.success?parsed.data:padrao(d)];})) as Record<Documento,Perfil>;
}
