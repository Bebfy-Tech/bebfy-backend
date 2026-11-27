import { describe,it,expect,vi } from 'vitest';
import { documentoFornecedor,buscarFornecedorDocumento } from './documento-fornecedor';
import { FornecedoresService } from './fornecedores.service';
describe('Cadastro de fornecedores',()=>{
 it('normaliza CPF e CNPJ e valida tipo',()=>{expect(documentoFornecedor('529.982.247-25','FISICA')).toBe('52998224725');expect(documentoFornecedor('11.222.333/0001-81','JURIDICA')).toBe('11222333000181');expect(()=>documentoFornecedor('52998224725','JURIDICA')).toThrow();});
 it('não associa documentos antigos duplicados automaticamente',async()=>{await expect(buscarFornecedorDocumento({$queryRaw:vi.fn().mockResolvedValue([{id:'a'},{id:'b'}])} as any,7,'11222333000181')).rejects.toThrow();});
 it('preserva histórico no DELETE',async()=>{const updateMany=vi.fn().mockResolvedValue({count:1});await new FornecedoresService({fornecedor:{updateMany}} as any).remove(7,'a');expect(updateMany).toHaveBeenCalledWith({where:{id:'a',empresaId:7},data:{ativo:false}});});
 it('bloqueia alteração de documento com nota',async()=>{const tx:any={fornecedor:{findFirst:vi.fn().mockResolvedValue({cnpj:'11222333000181',tipoPessoa:'JURIDICA'}),update:vi.fn()},notaFiscal:{count:vi.fn().mockResolvedValue(1)},contaPagar:{count:vi.fn().mockResolvedValue(0)}};await expect(new FornecedoresService({$transaction:(f:any)=>f(tx)} as any).update(7,'a',{cnpj:'52998224725',tipoPessoa:'FISICA'})).rejects.toThrow();expect(tx.fornecedor.update).not.toHaveBeenCalled();});
});
