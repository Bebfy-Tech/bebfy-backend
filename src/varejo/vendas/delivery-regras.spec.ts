import { resumoDelivery, validarTransicaoEntrega } from './delivery-regras';
describe('Fluxo de delivery',()=>{
 it('exige entregador para sair e não permite pular etapas',()=>{
  expect(()=>validarTransicaoEntrega('SEPARANDO','SAIU_PARA_ENTREGA',null)).toThrow();
  expect(()=>validarTransicaoEntrega('PENDENTE','ENTREGUE','e')).toThrow();
  expect(()=>validarTransicaoEntrega('SEPARANDO','SAIU_PARA_ENTREGA','e')).not.toThrow();
 });
 it('exige justificativa de ocorrência e confirmação de legado',()=>{
  expect(()=>validarTransicaoEntrega('SAIU_PARA_ENTREGA','NAO_ENTREGUE','e')).toThrow();
  expect(()=>validarTransicaoEntrega(null,'ENTREGUE','e')).toThrow();
  expect(()=>validarTransicaoEntrega(null,'ENTREGUE','e','Conferido manualmente')).not.toThrow();
 });
 it('separa dinheiro líquido, fiado e outros pagamentos',()=>{
  expect(resumoDelivery([{formaPagamento:'DINHEIRO',valor:100,troco:20},{formaPagamento:'FIADO',valor:30,troco:0},{formaPagamento:'PIX',valor:50,troco:0}])).toEqual({DINHEIRO:8000,PIX:5000,CARTAO_DEBITO:0,CARTAO_CREDITO:0,FIADO:3000});
 });
});
