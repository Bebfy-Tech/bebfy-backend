import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IniciarSessaoSuporteDto } from './iniciar-sessao-suporte.dto';

describe('IniciarSessaoSuporteDto', () => {
  const valido = {
    empresaId: 1,
    motivo: 'Cliente solicitou ajuda com o caixa',
    ticket: 'SUP-1234',
    consentimentoConfirmado: true,
  };

  it('accepts a tracked support request with explicit consent', async () => {
    expect(await validate(plainToInstance(IniciarSessaoSuporteDto, valido))).toHaveLength(0);
  });

  it('rejects missing customer consent', async () => {
    expect(await validate(plainToInstance(IniciarSessaoSuporteDto, { ...valido, consentimentoConfirmado: false }))).not.toHaveLength(0);
  });

  it('rejects missing ticket and short reasons', async () => {
    expect(await validate(plainToInstance(IniciarSessaoSuporteDto, { ...valido, ticket: '', motivo: 'erro' }))).not.toHaveLength(0);
  });
});
