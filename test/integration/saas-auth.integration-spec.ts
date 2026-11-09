import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient, SaasCargo } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const compiled = [
  resolve(process.cwd(), 'dist/src/app.module.js'),
  resolve(process.cwd(), 'dist/app.module.js'),
].find(existsSync);
if (!compiled) throw Error('Execute npm run build antes dos testes de integração.');
const { AppModule } = require(compiled);

describe('SaaS: administradores independentes das distribuidoras', () => {
  const db = new PrismaClient();
  let app: INestApplication;
  let adminId = '';
  let collaboratorId = '';
  let sampleCompanyId = 0;
  const code = 90000000 + Math.floor(Math.random() * 8000000);
  const password = 'senha-qa-forte-' + randomUUID();
  beforeAll(async () => {
    await db.$connect();
    const admin = await db.saasOperador.create({
      data: {codigo: code, nome: 'Administrador QA', senha: await bcrypt.hash(password, 12),
        cargo: SaasCargo.SUPER_ADMIN, permissoes: ['EMPRESAS','PLANOS','MODULOS','FUNCIONARIOS']},
    });
    adminId = admin.id;
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
    await app.init();
  }, 60000);
  afterAll(async () => {
    if (app) await app.close();
    if (sampleCompanyId) await db.empresa.deleteMany({where:{id:sampleCompanyId}});
    if (collaboratorId) await db.saasOperador.deleteMany({where:{id:collaboratorId}});
    if (adminId) await db.saasOperador.deleteMany({where:{id:adminId}});
    await db.$disconnect();
  });

  it('permite login exclusivo do SaaS e gestão de funcionários com permissões', async () => {
    const server = app.getHttpServer();
    const auth = await request(server).post('/saas/auth/login').send({codigo:code,senha:password});
    expect(auth.status).toBe(200);
    expect(auth.body.usuario.cargo).toBe('SUPER_ADMIN');
    const bearer = {Authorization: 'Bearer ' + auth.body.access_token};
    const perfil = await request(server).get('/saas/auth/perfil').set(bearer);
    expect(perfil.status).toBe(200);
    const created = await request(server).post('/saas/admin/funcionarios').set(bearer).send({
      codigo:code+1,nome:'Colaborador QA',senha:password,cargo:'OPERADOR',permissoes:['EMPRESAS'],
    });
    expect(created.status).toBe(201);
    collaboratorId = created.body.id;
    expect(created.body.senha).toBeUndefined();

    const employee = await request(server).post('/saas/auth/login').send({codigo:code+1,senha:password});
    expect(employee.status).toBe(200);
    const employeeBearer = {Authorization:'Bearer '+employee.body.access_token};
    const allowed = await request(server).get('/saas/admin/empresas').set(employeeBearer);
    expect(allowed.status).toBe(200);
    const denied = await request(server).get('/saas/admin/planos').set(employeeBearer);
    expect(denied.status).toBe(403);
    const disabled = await request(server).patch('/saas/admin/funcionarios/'+collaboratorId).set(bearer).send({ativo:false});
    expect(disabled.status).toBe(200);
    expect((await request(server).get('/saas/admin/empresas').set(employeeBearer)).status).toBe(401);
  });
  it('bloqueia inadimplência, libera prazo e preserva suspensão manual', async () => {
    const server = app.getHttpServer();
    const slug = 'saas-grace-' + randomUUID().slice(0, 8);
    const company = await db.empresa.create({
      data: { nomeFantasia: 'Grace QA', slug, subdominio: slug, status: 'ATIVA' },
    });
    sampleCompanyId = company.id;
    const auth = await request(server).post('/saas/auth/login').send({ codigo: code, senha: password });
    expect(auth.status).toBe(200);
    const token = { Authorization: 'Bearer ' + auth.body.access_token };

    const changed = await request(server).patch('/saas/admin/empresas/' + company.id + '/inadimplencia')
      .set(token).send({ inadimplente: true });
    expect(changed.status).toBe(200);
    expect(changed.body.inadimplente).toBe(true);
    expect((await request(server).post('/auth/login').set('x-tenant', slug)
      .send({ login: '1', senha: 'senha-invalida' })).status).toBe(404);

    const invalid = await request(server).post('/saas/admin/empresas/' + company.id + '/liberar-acesso')
      .set(token).send({ dias: 0, motivo: 'Sem justificativa' });
    expect(invalid.status).toBe(400);

    const release = await request(server).post('/saas/admin/empresas/' + company.id + '/liberar-acesso')
      .set(token).send({ dias: 7, motivo: 'Prazo concedido pela equipe de suporte.' });
    expect(release.status).toBe(201);
    expect(release.body.inadimplente).toBe(true);
    expect(new Date(release.body.liberacaoFinanceiraAte).getTime()).toBeGreaterThan(Date.now());

    const history = await request(server).get('/saas/admin/empresas/' + company.id).set(token);
    expect(history.status).toBe(200);
    expect(history.body.historicoLiberacoes.length).toBe(1);
    expect(history.body.historicoLiberacoes[0].operadorId).toBe(adminId);
    expect((await request(server).post('/auth/login').set('x-tenant', slug)
      .send({ login: '1', senha: 'senha-invalida' })).status).toBe(401);

    await db.empresa.update({
      where: { id: company.id }, data: { liberacaoFinanceiraAte: new Date(Date.now() - 60_000) },
    });
    expect((await request(server).post('/auth/login').set('x-tenant', slug)
      .send({ login: '1', senha: 'senha-invalida' })).status).toBe(404);

    await request(server).patch('/saas/admin/empresas/' + company.id + '/status')
      .set(token).send({ status: 'SUSPENSA' });
    const blockedGrace = await request(server).post('/saas/admin/empresas/' + company.id + '/liberar-acesso')
      .set(token).send({ dias: 7, motivo: 'Não permitir suspensão manual.' });
    expect(blockedGrace.status).toBe(400);
  });

});
