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

const compiled = [
  resolve(process.cwd(), 'dist/src/app.module.js'),
  resolve(process.cwd(), 'dist/app.module.js'),
].find(existsSync);
if (!compiled) throw Error('Execute npm run build antes da integração.');
const { AppModule } = require(compiled);

describe('Authorization boundaries: clerk cannot alter sensitive tenant assets', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;
  let slug = '';
  let ownerId = '';
  let clerkId = '';
  let ownerToken = '';
  let clerkToken = '';
  let ownerCaixaId = '';
  let prodId = 0;
  const H = (token: string) => ({ 'x-tenant': slug, Authorization: 'Bearer ' + token });

  beforeAll(async () => {
    await prisma.$connect();
    slug = 'authcheck-' + randomUUID().slice(0, 8);
    const loja = await prisma.empresa.create({
      data: { nomeFantasia: 'Authorization QA', slug, subdominio: slug },
    });
    for (const [role, code] of [['PROPRIETARIO', 901], ['OPERADOR_CAIXA', 902]] as const) {
      const employee = await prisma.funcionario.create({
        data: {
          empresaId: loja.id, nome: role, codigo: code,
          cpf: randomUUID().replace(/-/g, '').slice(0, 11), cargo: role,
        },
      });
      const usuario = await prisma.usuario.create({
        data: {
          funcionarioId: employee.id,
          email: randomUUID().slice(0, 8) + '@permissions.bebfy.invalid',
          senha: await bcrypt.hash('senha-forte-autorizacoes', 12), permissoes: [],
        },
      });
      if (code === 901) ownerId = employee.id;
      else clerkId = employee.id;
      expect(usuario.ativo).toBe(true);
    }
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
    const owner = await request(app.getHttpServer()).post('/auth/login').set('x-tenant', slug)
      .send({ login: '901', senha: 'senha-forte-autorizacoes' });
    const clerk = await request(app.getHttpServer()).post('/auth/login').set('x-tenant', slug)
      .send({ login: '902', senha: 'senha-forte-autorizacoes' });
    expect(owner.status).toBe(200);
    expect(clerk.status).toBe(200);
    ownerToken = owner.body.access_token;
    clerkToken = clerk.body.access_token;
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('permite leitura do catálogo, mas bloqueia alteração de preços, categorias e fornecedores', async () => {
    const server = app.getHttpServer();
    const created = await request(server).post('/produtos').set(H(ownerToken))
      .send({ nome: 'Produto protegido QA', precoVendaVarejo: 22, estoqueAtual: 10 });
    expect(created.status).toBe(201);
    prodId = created.body.id;

    const read = await request(server).get('/produtos').set(H(clerkToken));
    expect(read.status).toBe(200);
    const edit = await request(server).patch('/produtos/' + prodId).set(H(clerkToken))
      .send({ precoVendaVarejo: 0.01, estoqueAtual: 9999 });
    expect(edit.status).toBe(403);
    const createProduct = await request(server).post('/produtos').set(H(clerkToken))
      .send({ nome: 'Preço fraudulento QA', precoVendaVarejo: 0.01 });
    expect(createProduct.status).toBe(403);
    const createCategory = await request(server).post('/categorias').set(H(clerkToken))
      .send({ nome: 'Categoria indevida' });
    expect(createCategory.status).toBe(403);
    const createSupplier = await request(server).post('/fornecedores').set(H(clerkToken))
      .send({ razaoSocial: 'Fornecedor indevido', cnpj: '11122233300019' });
    expect(createSupplier.status).toBe(403);
    const postLot = await request(server).post('/lotes').set(H(clerkToken))
      .send({ produtoId: prodId, quantidade: 10 });
    expect(postLot.status).toBe(403);

    const updated = await request(server).get('/produtos/' + prodId).set(H(ownerToken));
    expect(updated.status).toBe(200);
    expect(Number(updated.body.precoVendaVarejo)).toBe(22);
    expect(updated.body.estoqueAtual).toBe(10);
  });

  it('impede reescrever fiados/cascos e limita crédito à gestão', async () => {
    const server = app.getHttpServer();
    const invalid = await request(server).post('/clientes').set(H(clerkToken))
      .send({ nome: 'Cliente forjado', saldoDevedor: -300, cascosEmPosse: -10 });
    expect(invalid.status).toBe(400);
    const client = await request(server).post('/clientes').set(H(clerkToken))
      .send({ nome: 'Cliente simples QA' });
    expect(client.status).toBe(201);
    const limit = await request(server).patch('/clientes/' + client.body.id).set(H(clerkToken))
      .send({ limiteCredito: 100000 });
    expect(limit.status).toBe(403);
    const balance = await request(server).patch('/clientes/' + client.body.id).set(H(clerkToken))
      .send({ saldoDevedor: -800 });
    expect(balance.status).toBe(400);
    const deleteClient = await request(server).delete('/clientes/' + client.body.id).set(H(clerkToken));
    expect(deleteClient.status).toBe(403);

    const updated = await request(server).get('/clientes/' + client.body.id).set(H(ownerToken));
    expect(updated.status).toBe(200);
    expect(Number(updated.body.saldoDevedor)).toBe(0);
    expect(Number(updated.body.limiteCredito)).toBe(0);
  });

  it('impede abrir caixa e registrar venda em nome de outro funcionário', async () => {
    const server = app.getHttpServer();
    const openOther = await request(server).post('/caixa/abrir').set(H(clerkToken))
      .send({ operadorId: ownerId, saldoInicial: 0 });
    expect(openOther.status).toBe(403);
    const open = await request(server).post('/caixa/abrir').set(H(ownerToken))
      .send({ operadorId: ownerId, saldoInicial: 0 });
    expect(open.status).toBe(201);
    ownerCaixaId = open.body.id;
    const fraud = await request(server).post('/vendas').set(H(clerkToken)).send({
      caixaId: ownerCaixaId, funcionarioId: ownerId,
      itens: [{ produtoId: prodId, quantidade: 1, precoUnitario: 22 }],
      pagamentos: [{ formaPagamento: 'PIX', valor: 22 }],
    });
    expect(fraud.status).toBe(403);
    const wrongCashier = await request(server).post('/vendas').set(H(clerkToken)).send({
      caixaId: ownerCaixaId, funcionarioId: clerkId,
      itens: [{ produtoId: prodId, quantidade: 1, precoUnitario: 22 }],
      pagamentos: [{ formaPagamento: 'PIX', valor: 22 }],
    });
    expect(wrongCashier.status).toBe(400);

    const fresh = await request(server).get('/produtos/' + prodId).set(H(ownerToken));
    expect(fresh.body.estoqueAtual).toBe(10);
  });

  it('não concede acesso administrativo a um operador padrão', async () => {
    const server = app.getHttpServer();
    for (const url of ['/funcionarios', '/financeiro/resumo', '/saas/admin/empresas']) {
      const response = await request(server).get(url).set(H(clerkToken));
      expect(response.status, url).toBe(url.startsWith('/saas/admin/') ? 401 : 403);
    }
    const sales = await request(server).get('/vendas').set(H(clerkToken));
    expect(sales.status).toBe(200);
  });
});
