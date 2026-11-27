import {describe,it,expect} from 'vitest';
import {configuracaoSchema,exigirEditor,exigirDocumentoVenda} from './configuracoes-regras';
const dados={telefone:'62999999999',endereco:'Rua A',mensagemComprovante:'Obrigado!',obrigarCpfClienteVenda:true,revisao:null};
describe('Configurações da empresa',()=>{
 it('rejeita alteração de campos SaaS e propriedades extras',()=>{expect(configuracaoSchema.safeParse(dados).success).toBe(true);expect(configuracaoSchema.safeParse({...dados,planoId:1}).success).toBe(false);expect(configuracaoSchema.safeParse({...dados,empresaId:2}).success).toBe(false);});
 it('somente administrador ou proprietário altera',()=>{expect(()=>exigirEditor('GERENTE')).toThrow();expect(()=>exigirEditor('OPERADOR_CAIXA')).toThrow();expect(()=>exigirEditor('PROPRIETARIO')).not.toThrow();expect(()=>exigirEditor('ADMINISTRADOR')).not.toThrow();});
 it('identificação obrigatória exige documento válido',()=>{expect(()=>exigirDocumentoVenda(true,null)).toThrow();expect(()=>exigirDocumentoVenda(true,'11111111111')).toThrow();expect(()=>exigirDocumentoVenda(true,'529.982.247-25')).not.toThrow();expect(()=>exigirDocumentoVenda(false,null)).not.toThrow();});
});
