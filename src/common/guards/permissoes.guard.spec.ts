import { describe, expect, it } from 'vitest';
import { ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExigirPermissao, PermissoesGuard } from './permissoes.guard';

class ControladorTeste {
  @ExigirPermissao('VENDAS_CANCELAR')
  cancelar() {}
}

function contexto(usuario: any): any {
  return {
    getHandler: () => ControladorTeste.prototype.cancelar,
    getClass: () => ControladorTeste,
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  };
}

describe('PermissoesGuard', () => {
  const guard = new PermissoesGuard(new Reflector());

  it('nega operação crítica a operador sem permissão', () => {
    expect(() => guard.canActivate(contexto({ cargo: 'OPERADOR_CAIXA', permissoes: [] })))
      .toThrow(ForbiddenException);
  });

  it('autoriza operador com permissão explícita', () => {
    expect(guard.canActivate(contexto({
      cargo: 'OPERADOR_CAIXA', permissoes: ['VENDAS_CANCELAR'],
    }))).toBe(true);
  });

  it('autoriza gestor da empresa', () => {
    expect(guard.canActivate(contexto({ cargo: 'GERENTE', permissoes: [] }))).toBe(true);
  });
});
