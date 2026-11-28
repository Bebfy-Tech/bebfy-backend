import {describe,it,expect} from 'vitest';
import {documentos,padrao,perfilSchema,perfisValidos,impressaoSchema} from './impressao-regras';
describe('Perfis de impressão',()=>{
 it('gera padrões válidos para todos os documentos',()=>{expect(impressaoSchema.safeParse({perfis:perfisValidos(null),revisao:null}).success).toBe(true);expect(Object.keys(perfisValidos(null))).toHaveLength(documentos.length);});
 it('rejeita medidas inválidas, CSS e margem excessiva',()=>{const p=padrao('venda');for(const v of [{...p,largura:210},{...p,esquerda:40,direita:40},{...p,orientacao:'PAISAGEM'},{...p,css:'body{}'},{...p,tamanho:100}])expect(perfilSchema.safeParse(v).success).toBe(false);});
 it('preserva configurações válidas e normaliza dados antigos',()=>{expect(perfisValidos({venda:{...padrao('venda'),tamanho:12},dre:{papel:'errado'}}).venda.tamanho).toBe(12);expect(perfisValidos({dre:{papel:'errado'}}).dre).toEqual(padrao('dre'));});
});
