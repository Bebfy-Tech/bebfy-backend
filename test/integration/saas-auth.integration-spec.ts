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
});
