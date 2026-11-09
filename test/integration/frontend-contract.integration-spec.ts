import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
// Load the compiled NestJS application so TypeScript decorator metadata is preserved.
// Vitest/esbuild does not emit design:paramtypes required by Nest dependency injection.
const { AppModule } = require('../../dist/app.module.js');

describe('HTTP contracts: React frontend / backend multi-tenant', () => {
  const prisma = new PrismaClient();
  let app: INestApplication;
  let slug: string;
  let outroSlug: string;
  let codigo: number;
  let funcionarioId: string;
  let produtoId: number;
  let caixaId: string;
  let token: string;

  beforeAll(async () => {
    await prisma.$connect();
    const marcador = randomUUID().slice(0, 8);
    slug = 'loja-contrato-' + marcador;
    outroSlug = 'loja-isolada-' + marcador;
    codigo = 800000 + Math.floor(Math.random() * 100000);
    const loja = await prisma.empresa.create({
      data: { nomeFantasia: 'Bebfy Contrato', slug, subdominio: slug },
    });
    await prisma.empresa.create({
      data: { nomeFantasia: 'Empresa Isolada', slug: outroSlug, subdominio: outroSlug },
    });
    const operador = await prisma.funcionario.create({
      data: {
        empresaId: loja.id, nome: 'Operador integração', cpf: '12345678900',
        cargo: 'PROPRIETARIO', codigo,
      },
    });
    funcionarioId = operador.id;
    await prisma.usuario.create({
      data: {
        email: marcador + '@teste.bebfy.invalid', funcionarioId,
        senha: await bcrypt.hash('senha-contrato-segura', 10),
        permissoes: [], ativo: true,
      },
    });
    const caixa = await prisma.caixa.create({
      data: { empresaId: loja.id, operadorId: funcionarioId, saldoInicial: 0 },
    });
    caixaId = caixa.id;
    const produto = await prisma.produto.create({
      data: {
        empresaId: loja.id, nome: 'Produto contrato',
        estoqueAtual: 5, precoVendaVarejo: 10,
      },
    });
    produtoId = produto.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true, forbidNonWhitelisted: true, transform: true,
      transformOptions: { enableImplicitConversion: true },
    }));
    await app.init();
  }, 60000);

  afterAll(async () => {
    if (app) await app.close();
    await prisma.$disconnect();
  });

  it('exige empresa informada antes do login', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
      login: String(codigo), senha: 'senha-contrato-segura',
    });
    expect(response.status).toBe(401);
  });

  it('faz login com x-tenant, devolve a sessão e lista produtos da loja', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login').set('x-tenant', slug)
      .send({ login: String(codigo), senha: 'senha-contrato-segura' });
    expect(response.status).toBe(200);
    expect(response.body.empresa.subdominio).toBe(slug);
    expect(typeof response.body.access_token).toBe('string');
    expect(response.body.usuario.funcionarioId).toBe(funcionarioId);
    token = response.body.access_token;

    const perfil = await request(app.getHttpServer())
      .get('/auth/perfil').set('x-tenant', slug)
      .set('Authorization', 'Bearer ' + token);
    expect(perfil.status).toBe(200);
    expect(perfil.body.empresaId).toBe(response.body.empresa.id);

    const produtos = await request(app.getHttpServer())
      .get('/produtos').set('x-tenant', slug)
      .set('Authorization', 'Bearer ' + token);
    expect(produtos.status).toBe(200);
    expect(produtos.body.some((p: { id: number }) => p.id === produtoId)).toBe(true);
  });

  it('impede token da loja A em host/cabeçalho da loja B', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/perfil').set('x-tenant', outroSlug)
      .set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(401);
  });

  it('registra a venda, retorna comprovante não fiscal e não expõe endpoint de NF-e', async () => {
    const headers = { 'x-tenant': slug, Authorization: 'Bearer ' + token };
    const venda = await request(app.getHttpServer())
      .post('/vendas').set(headers).send({
        caixaId, funcionarioId,
        itens: [{ produtoId, quantidade: 2, precoUnitario: 10 }],
        pagamentos: [{ formaPagamento: 'DINHEIRO', valor: 20 }],
      });
    expect(venda.status).toBe(201);
    const recibo = await request(app.getHttpServer())
      .get('/vendas/' + venda.body.id + '/comprovante').set(headers);
    expect(recibo.status).toBe(200);
    expect(recibo.body.tipo).toBe('COMPROVANTE_NAO_FISCAL');
    expect(recibo.body.aviso).toContain('Não substitui NFC-e ou NF-e');
    expect(recibo.body.valores.total).toBe(20);
    expect(recibo.body.itens[0].quantidade).toBe(2);

    const fiscal = await request(app.getHttpServer()).get('/notas-fiscais').set(headers);
    expect(fiscal.status).toBe(404);
  });
});
