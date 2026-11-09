import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateVendaDto } from './create-venda.dto';

const base = {
  caixaId: 'caixa',
  funcionarioId: 'funcionario',
  itens: [{ produtoId: 1, quantidade: 1, precoUnitario: 10 }],
  pagamentos: [{ formaPagamento: 'DINHEIRO', valor: 10 }],
};

async function erros(body: Record<string, unknown>) {
  return validate(plainToInstance(CreateVendaDto, body));
}

describe('CreateVendaDto', () => {
  it('aceita uma venda válida', async () => {
    expect(await erros(base)).toHaveLength(0);
  });

  it('rejeita uma venda sem itens', async () => {
    expect(await erros({ ...base, itens: [] })).not.toHaveLength(0);
  });

  it('rejeita estoque negativo ou quantidade zero', async () => {
    expect(await erros({ ...base, itens: [{ produtoId: 1, quantidade: 0, precoUnitario: 10 }] })).not.toHaveLength(0);
    expect(await erros({ ...base, itens: [{ produtoId: 1, quantidade: -2, precoUnitario: 10 }] })).not.toHaveLength(0);
  });

  it('rejeita pagamento negativo e lista vazia', async () => {
    expect(await erros({ ...base, pagamentos: [] })).not.toHaveLength(0);
    expect(await erros({ ...base, pagamentos: [{ formaPagamento: 'DINHEIRO', valor: -1 }] })).not.toHaveLength(0);
  });

  it('rejeita troco negativo', async () => {
    expect(await erros({ ...base, pagamentos: [{ formaPagamento: 'DINHEIRO', valor: 10, troco: -1 }] })).not.toHaveLength(0);
  });
});
