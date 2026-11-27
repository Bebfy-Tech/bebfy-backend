import { describe, expect, it } from 'vitest';
import { validarHierarquia, validarPermissoes, validarSenhaTemporaria } from './funcionarios-regras';
describe('Regras de funcionários',()=>{
 it('impede gerente de administrar administrador ou proprietário',()=>{expect(()=>validarHierarquia('GERENTE','ADMINISTRADOR')).toThrow();expect(()=>validarHierarquia('GERENTE','PROPRIETARIO')).toThrow();});
 it('impede administrador de administrar proprietário',()=>expect(()=>validarHierarquia('ADMINISTRADOR','PROPRIETARIO')).toThrow());
 it('permite gestor administrar operador',()=>expect(()=>validarHierarquia('GERENTE','OPERADOR_CAIXA')).not.toThrow());
 it('rejeita permissões desconhecidas e remove duplicadas',()=>{expect(()=>validarPermissoes(['ADMIN'])).toThrow();expect(validarPermissoes(['ESTOQUE_AJUSTAR','ESTOQUE_AJUSTAR'])).toEqual(['ESTOQUE_AJUSTAR']);});
 it('rejeita senha curta e truncamento bcrypt',()=>{expect(()=>validarSenhaTemporaria('123')).toThrow();expect(()=>validarSenhaTemporaria('á'.repeat(40))).toThrow();expect(()=>validarSenhaTemporaria('Temporaria123!')).not.toThrow();});
});
