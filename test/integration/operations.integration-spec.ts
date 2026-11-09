import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';

const appPath = [
  resolve(process.cwd(), 'dist/src/app.module.js'),
  resolve(process.cwd(), 'dist/app.module.js'),
].find(p => existsSync(p));
if (!appPath) throw Error('Compile o backend antes dos testes: npm run build.');
const { AppModule } = require(appPath);

describe('API operacional: contratos integrados e segurança por empresa', () => {
  const db = new PrismaClient();
  let app: INestApplication;
  let empresaId: number;
  let slug = '';
  let funcionarioId = '';
  let userId = '';
  let token = '';
  let caixaId = '';
  let produtoId = 0;
  let clienteId = '';
  const headers = () => ({ 'x-tenant': slug, Authorization: 'Bearer ' + token });

  beforeAll(async () => {
    await db.$connect();
    slug = 'operacoes-' + randomUUID().slice(0, 8);
    const company = await db.empresa.create({ data: { nomeFantasia: 'Bebfy QA Operações', subdominio: slug, slug } });
    empresaId = company.id;
    const employee = await db.funcionario.create({
      data: { empresaId, nome: 'Proprietário QA', cpf: randomUUID().replace(/-/g, '').slice(0, 11), codigo: 9981, cargo: 'PROPRIETARIO' },
    });
    funcionarioId = employee.id;
    const user = await db.usuario.create({
      data: {
        funcionarioId, email: 'operacoes-' + randomUUID() + '@bebfy.invalid',
        senha: await bcrypt.hash('senha-operacional-forte-2026', 12), permissoes: [],
      },
    });
    userId = user.id;

    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
    const login = await request(app.getHttpServer()).post('/auth/login').set('x-tenant', slug)
      .send({ login: '9981', senha: 'senha-operacional-forte-2026' });
    if (login.status !== 200 || !login.body.access_token) throw Error('Login do cenário QA falhou: ' + login.status);
    token = login.body.access_token;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    await db.$disconnect();
  });

  it('cadastro de categorias, produtos, lotes, fornecedores e pesquisa de EAN', async () => {
    const server = app.getHttpServer();
    const cat = await request(server).post('/categorias').set(headers())
      .send({ nome: 'Cervejas QA ' + slug, descricao: 'Nacional e importada' });
    expect(cat.status).toBe(201);
    const created = await request(server).post('/produtos').set(headers()).send({
      nome: 'Cerveja QA 350ml', precoVendaVarejo: 10, precoCusto: 5,
      codigoBarras: '789' + String(empresaId).padStart(10, '0'),
      estoqueAtual: 20, estoqueMinimo: 3, categoriaId: cat.body.id,
      unidadeMedida: 'UN',
    });
    expect(created.status).toBe(201);
    produtoId = created.body.id;
    const code = await request(server).get('/produtos/codigo-barras/' + created.body.codigoBarras).set(headers());
    expect(code.status).toBe(200);
    expect(code.body.id).toBe(produtoId);
    const edited = await request(server).patch('/produtos/' + produtoId).set(headers())
      .send({ precoVendaVarejo: 11 });
    expect(edited.status).toBe(200);

    const lot = await request(server).post('/lotes').set(headers())
      .send({ produtoId, numeroLote: 'QA-001', quantidade: 3, dataVencimento: '2027-05-12' });
    expect(lot.status).toBe(201);
    const lots = await request(server).get('/lotes').set(headers());
    expect(lots.status).toBe(200);
    expect(lots.body.some((r: { numeroLote: string }) => r.numeroLote === 'QA-001')).toBe(true);
    const detail = await request(server).get('/produtos/' + produtoId).set(headers());
    expect(detail.status).toBe(200);
    expect(detail.body.lotes.some((r: { numeroLote: string }) => r.numeroLote === 'QA-001')).toBe(true);

    const supplier = await request(server).post('/fornecedores').set(headers()).send({
      razaoSocial: 'Distribuição QA Ltda', nomeFantasia: 'Fornecedor Testes',
      cnpj: '11122233300019',
    });
    expect(supplier.status).toBe(201);
    const suppliers = await request(server).get('/fornecedores').set(headers());
    expect(suppliers.status).toBe(200);
    expect(suppliers.body.some((r: { id: string }) => r.id === supplier.body.id)).toBe(true);
  });

  it('cadastro de clientes, venda fiada, baixa de estoque e recebimento no caixa', async () => {
    const server = app.getHttpServer();
    const cliente = await request(server).post('/clientes').set(headers()).send({
      nome: 'Cliente QA Teste', limiteCredito: 200,
    });
    expect(cliente.status).toBe(201);
    clienteId = cliente.body.id;

    const caixa = await request(server).post('/caixa/abrir').set(headers())
      .send({ operadorId: funcionarioId, saldoInicial: 15 });
    expect(caixa.status).toBe(201);
    caixaId = caixa.body.id;

    const before = await request(server).get('/produtos/' + produtoId).set(headers());
    expect(before.status).toBe(200);
    const venda = await request(server).post('/vendas').set(headers()).send({
      caixaId, funcionarioId, clienteId,
      itens: [{ produtoId, quantidade: 2, precoUnitario: 11 }],
      pagamentos: [{ formaPagamento: 'FIADO', valor: 22 }],
    });
    expect(venda.status).toBe(201);
    const after = await request(server).get('/produtos/' + produtoId).set(headers());
    expect(after.status).toBe(200);
    expect(after.body.estoqueAtual).toBe(before.body.estoqueAtual - 2);

    const balance = await request(server).get('/clientes/' + clienteId).set(headers());
    expect(balance.status).toBe(200);
    expect(Number(balance.body.saldoDevedor)).toBe(22);

    const settle = await request(server).post('/fiados/pagar/' + clienteId).set(headers())
      .send({ valor: 12, formaPagamento: 'DINHEIRO', caixaId });
    expect(settle.status).toBe(201);
    expect(settle.body.saldoDevedorAtual).toBe(10);
    const extract = await request(server).get('/caixa/' + caixaId + '/extrato').set(headers());
    expect(extract.status).toBe(200);
    expect(extract.body.totalSuprimentos).toBe(12);

    const receipt = await request(server).get('/vendas/' + venda.body.id + '/comprovante').set(headers());
    expect(receipt.status).toBe(200);
    expect(receipt.body.tipo).toBe('COMPROVANTE_NAO_FISCAL');
  });

  it('vasilhames exigem produto retornável e registram empréstimo e devolução', async () => {
    const server = app.getHttpServer();
    const produto = await request(server).post('/produtos').set(headers())
      .send({ nome: 'Garrafa QA retornável', precoVendaVarejo: 2, retornavel: true, estoqueAtual: 10 });
    expect(produto.status).toBe(201);
    const emprestimo = await request(server).post('/produtos/vasilhames/movimentacao').set(headers())
      .send({ clienteId, produtoId: produto.body.id, tipo: 'EMPRESTIMO_SAIDA', quantidade: 2 });
    expect(emprestimo.status).toBe(201);
    const devolucao = await request(server).post('/produtos/vasilhames/movimentacao').set(headers())
      .send({ clienteId, produtoId: produto.body.id, tipo: 'DEVOLUCAO_ENTRADA', quantidade: 1 });
    expect(devolucao.status).toBe(201);
    const extrato = await request(server).get('/produtos/vasilhames/cliente/' + clienteId + '/extrato').set(headers());
    expect(extrato.status).toBe(200);
    expect(extrato.body.cliente.cascosEmPosse).toBe(1);
    expect(extrato.body.historico.length).toBeGreaterThanOrEqual(2);
  });

  it('contas a pagar e a receber passam por pendente e pago', async () => {
    const server = app.getHttpServer();
    const payable = await request(server).post('/financeiro/contas-pagar').set(headers()).send({
      descricao: 'Fornecedor QA', valor: 110, categoria: 'COMPRA', dataVencimento: '2027-01-30',
    });
    expect(payable.status).toBe(201);
    const receivable = await request(server).post('/financeiro/contas-receber').set(headers()).send({
      descricao: 'Cliente QA', valor: 150, dataVencimento: '2027-02-01',
    });
    expect(receivable.status).toBe(201);
    const resumo = await request(server).get('/financeiro/resumo').set(headers());
    expect(resumo.status).toBe(200);
    expect(resumo.body.saldoPrevisto).toBeGreaterThanOrEqual(40);
    const pago = await request(server).patch('/financeiro/contas-pagar/' + payable.body.id + '/pagar').set(headers());
    expect(pago.status).toBe(200);
    const recebida = await request(server).patch('/financeiro/contas-receber/' + receivable.body.id + '/receber').set(headers());
    expect(recebida.status).toBe(200);
    expect(pago.body.status).toBe('PAGO');
    expect(recebida.body.status).toBe('PAGO');
  });

  it('bloqueia SaaS global para proprietário não autorizado e expõe áreas ao gestor', async () => {
    const server = app.getHttpServer();
    const antigo = process.env.SAAS_ADMIN_USER_IDS;
    delete process.env.SAAS_ADMIN_USER_IDS;
    const denied = await request(server).get('/saas/admin/empresas').set(headers());
    expect(denied.status).toBe(403);
    process.env.SAAS_ADMIN_USER_IDS = userId;
    const allowed = await request(server).get('/saas/admin/empresas').set(headers());
    if (antigo===undefined) delete process.env.SAAS_ADMIN_USER_IDS;
    else process.env.SAAS_ADMIN_USER_IDS = antigo;
    expect(allowed.status).toBe(200);
    expect(allowed.body.some((e: { id: number }) => e.id === empresaId)).toBe(true);
    for (const path of ['/funcionarios', '/vendas', '/caixa', '/fiados', '/relatorios/dashboard']) {
      const res = await request(server).get(path).set(headers());
      expect(res.status, path).toBe(200);
    }
  });

  it('bloqueia saldos inconsistentes e fecha caixa com valor reconciliado', async () => {
    const server = app.getHttpServer();
    const overpay = await request(server).post('/fiados/pagar/' + clienteId).set(headers())
      .send({ valor: 100, formaPagamento: 'PIX' });
    expect(overpay.status).toBe(400);

    const statement = await request(server).get('/caixa/' + caixaId + '/extrato').set(headers());
    expect(statement.status).toBe(200);
    const close = await request(server).patch('/caixa/' + caixaId + '/fechar').set(headers())
      .send({ saldoFinalFisico: statement.body.saldoParcialSistema });
    expect(close.status).toBe(200);
    expect(Number(close.body.quebraDeCaixa)).toBe(0);
  });
});
