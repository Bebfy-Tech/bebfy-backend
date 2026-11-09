import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { NotasFiscaisService } from './notas-fiscais.service';

describe('NotasFiscaisService: XML security', () => {
  const service = new NotasFiscaisService({} as any);

  it('nega DTD e entidades externas', async () => {
    await expect(service.importar(1, {
      xml: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    })).rejects.toThrow(BadRequestException);
  });

  it('nega XML sem protocolo autorizado de NF-e', async () => {
    await expect(service.importar(1, {
      xml: '<NFe><infNFe Id="NFe00000000000000000000000000000000000000000000"></infNFe></NFe>',
    })).rejects.toThrow(BadRequestException);
  });

  it('nega XML sintaticamente inválido', async () => {
    await expect(service.importar(1, { xml: '<NFe><infNFe></NFe>' }))
      .rejects.toThrow(BadRequestException);
  });
});
