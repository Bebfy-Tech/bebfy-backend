import { validarDocumento } from './documento';
describe('CPF/CNPJ do cliente',()=>{
 it('normaliza CPF e CNPJ numéricos',()=>{
  expect(validarDocumento('529.982.247-25')).toBe('52998224725');
  expect(validarDocumento('11.222.333/0001-81')).toBe('11222333000181');
 });
 it('aceita CNPJ alfanumérico com dígitos verificadores válidos',()=>expect(validarDocumento('12.ABC.345/01DE-35')).toBe('12ABC34501DE35'));
 it('aceita documento ausente',()=>expect(validarDocumento('')).toBeNull());
 it('rejeita sequências e documentos inválidos',()=>{
  for(const d of ['00000000000','11111111111111','52998224724','11222333000180','ABC'])expect(()=>validarDocumento(d)).toThrow();
 });
});
