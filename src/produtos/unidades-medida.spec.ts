import { describe,it,expect,vi } from 'vitest';
import { normalizarSigla,unidadeAtiva,UnidadesService } from './unidades-medida';
describe('Unidades por empresa',()=>{
 it('normaliza e rejeita siglas inválidas',()=>{expect(normalizarSigla(' cx ')).toBe('CX');expect(()=>normalizarSigla('caixa!')).toThrow();});
 it('rejeita unidade de outra empresa ou inativa',async()=>{const findFirst=vi.fn().mockResolvedValue(null);await expect(unidadeAtiva({unidadeMedida:{findFirst}} as any,7,{id:'x'})).rejects.toThrow();expect(findFirst).toHaveBeenCalledWith({where:{empresaId:7,ativo:true,id:'x'}});});
 it('não exclui unidade vinculada',async()=>{const tx:any={unidadeMedida:{findFirst:vi.fn().mockResolvedValue({id:'x',sigla:'UN'}),delete:vi.fn()},produto:{count:vi.fn().mockResolvedValue(1)}};await expect(new UnidadesService({$transaction:(fn:any)=>fn(tx)} as any).excluir(7,'x')).rejects.toThrow();expect(tx.unidadeMedida.delete).not.toHaveBeenCalled();});
});
