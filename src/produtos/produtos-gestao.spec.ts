import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ProdutosService } from './produtos.service';

describe('Gestão de produtos', () => {
  it('lista ativos e inativos somente do tenant, sem conteúdo binário das fotos', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new ProdutosService({produto:{findMany}} as any);
    await service.listarGestao(7);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where:{empresaId:7},include:{categoria:true,lotes:true,foto:{select:{produtoId:true}}},
    }));
  });
  it('mantém a listagem operacional restrita a ativos', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await new ProdutosService({produto:{findMany}} as any).findAll(7);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{empresaId:7,ativo:true}}));
  });
  it('reativa apenas um produto do tenant', async () => {
    const updateMany=vi.fn().mockResolvedValue({count:1});
    const service=new ProdutosService({produto:{updateMany}} as any);
    await expect(service.alterarSituacao(12,7,true)).resolves.toEqual({ok:true,ativo:true});
    expect(updateMany).toHaveBeenCalledWith({where:{id:12,empresaId:7},data:{ativo:true}});
  });
  it('rejeita alterações em produto de outro tenant ou inexistente', async () => {
    const updateMany=vi.fn().mockResolvedValue({count:0});
    await expect(new ProdutosService({produto:{updateMany}} as any).alterarSituacao(12,7,false)).rejects.toThrow(NotFoundException);
  });
});
