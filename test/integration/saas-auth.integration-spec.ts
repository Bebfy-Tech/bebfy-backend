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
  let billingPlanId = 0;
  let reusedAdminToken = '';
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
    if (billingPlanId) await db.plano.deleteMany({where:{id:billingPlanId}});
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
  it('permite editar nome e e-mail do administrador principal sem alterar código, senha ou permissões', async () => {
    const server = app.getHttpServer();
    const codeOne = await db.saasOperador.findUnique({ where: { codigo: 1 } });
    // This suite only modifies temporary QA records, never existing operators.
    if (codeOne) return;
    const primary = await db.saasOperador.create({
      data: { codigo: 1, nome: 'Administrador 1 QA', senha: await bcrypt.hash(password, 12),
        cargo: SaasCargo.SUPER_ADMIN, permissoes: ['EMPRESAS','PLANOS','MODULOS','FUNCIONARIOS'] },
    });
    try {
      const auth = await request(server).post('/saas/auth/login').send({ codigo: code, senha: password });
      expect(auth.status).toBe(200);
      const token = { Authorization: 'Bearer ' + auth.body.access_token };
      const path = '/saas/admin/funcionarios/' + primary.id;
      const updated = await request(server).patch(path).set(token)
        .send({ nome: 'Administrador Principal QA', email: 'principal-qa-' + randomUUID() + '@bebfy.invalid' });
      expect(updated.status).toBe(200);
      expect(updated.body.nome).toBe('Administrador Principal QA');
      expect(updated.body.email).toContain('@bebfy.invalid');
      expect(updated.body.senha).toBeUndefined();
      const forbiddenCode = await request(server).patch(path).set(token).send({ codigo: 3 });
      expect(forbiddenCode.status).toBe(400);
      const forbiddenDisable = await request(server).patch(path).set(token).send({ ativo: false });
      expect(forbiddenDisable.status).toBe(403);
      const forbiddenPermissions = await request(server).patch(path).set(token).send({ permissoes: [] });
      expect(forbiddenPermissions.status).toBe(403);
      const forbiddenPassword = await request(server).patch(path).set(token).send({ senha: 'outra' });
      expect(forbiddenPassword.status).toBe(403);
      const after = await db.saasOperador.findUniqueOrThrow({ where: { id: primary.id } });
      expect(after.codigo).toBe(1);
      expect(after.ativo).toBe(true);
      expect(after.cargo).toBe(SaasCargo.SUPER_ADMIN);
      expect(await bcrypt.compare(password, after.senha)).toBe(true);
    } finally {
      await db.saasOperador.delete({ where: { id: primary.id } });
    }
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

  it('registra OS manual com histórico WhatsApp, encaminha ao Dev e resolve com solução', async () => {
    const server = app.getHttpServer();
    const auth = await request(server).post('/saas/auth/login').send({codigo:code,senha:password});
    expect(auth.status).toBe(200);
    reusedAdminToken = auth.body.access_token;
    const token={ Authorization:'Bearer '+reusedAdminToken };
    const create=await request(server).post('/saas/admin/suporte/chamados').set(token)
      .send({empresaId:sampleCompanyId,titulo:'Falha ao abrir caixa no PDV',
        descricao:'Cliente informou pelo WhatsApp que não consegue abrir o caixa.',
        contatoNome:'Cliente QA',contatoTelefone:'62999998888',categoria:'ERRO',prioridade:'ALTA'});
    expect(create.status).toBe(201);
    expect(create.body.status).toBe('PENDENTE');
    expect(create.body.comDev).toBe(false);
    expect(create.body.numero).toBeGreaterThan(0);
    const path='/saas/admin/suporte/chamados/'+create.body.id;
    const toDev=await request(server).patch(path).set(token)
      .send({status:'COM_DEV',comDev:true,devResponsavel:'Equipe Backend'});
    expect(toDev.status).toBe(200);
    expect(toDev.body.status).toBe('COM_DEV');
    expect(toDev.body.comDev).toBe(true);
    const message=await request(server).post(path+'/interacoes').set(token)
      .send({mensagem:'Solicitamos evidências pelo WhatsApp e encaminhamos ao Dev.'});
    expect(message.status).toBe(201);
    const active=await request(server).get(path).set(token);
    expect(active.status).toBe(200);
    expect(active.body.eventos.map((x:{acao:string})=>x.acao)).toContain('INTERACAO_WHATSAPP');
    const unresolved=await request(server).patch(path).set(token).send({status:'RESOLVIDO'});
    expect(unresolved.status).toBe(400);
    const resolved=await request(server).patch(path).set(token)
      .send({status:'RESOLVIDO',solucao:'Corrigimos a configuração de caixa e o cliente confirmou.'});
    expect(resolved.status).toBe(200);
    expect(resolved.body.status).toBe('RESOLVIDO');
    expect(resolved.body.comDev).toBe(false);
    expect(resolved.body.resolvidoEm).toBeTruthy();
    expect((await request(server).get('/saas/admin/suporte/chamados').set(token)).body
      .some((c:{id:string})=>c.id===create.body.id)).toBe(true);
    expect((await request(server).get(path)).status).toBe(401);
  });

  it('controla cobranças, pagamentos parciais, documentos privados e histórico financeiro', async () => {
    const server = app.getHttpServer();
    expect(reusedAdminToken).toBeTruthy();
    const bearer = { Authorization: 'Bearer ' + reusedAdminToken };
    await db.empresa.update({ where: { id: sampleCompanyId }, data: { status: 'ATIVA' } });

    const initial = await request(server).get('/saas/admin/financeiro').set(bearer);
    expect(initial.status).toBe(200);
    expect(initial.body.empresas.some((c:{id:number})=>c.id===sampleCompanyId)).toBe(true);

    const created = await request(server).post('/saas/admin/empresas/' + sampleCompanyId + '/cobrancas')
      .set(bearer).send({ referencia: 'QA assinatura ' + randomUUID().slice(0,6),
        valor: 120.50, vencimento: '2026-12-15T12:00:00.000Z' });
    expect(created.status).toBe(201);
    const cobrancaId = created.body.id;
    const prefix = '/saas/admin/financeiro/empresas/' + sampleCompanyId;
    const paymentsUrl = prefix + '/cobrancas/' + cobrancaId + '/pagamentos';
    const partial = await request(server).post(paymentsUrl).set(bearer)
      .send({valor:40.50,pagoEm:new Date().toISOString(),forma:'PIX'});
    expect(partial.status).toBe(201);
    const afterPartial = await request(server).get('/saas/admin/financeiro').set(bearer);
    const bill = afterPartial.body.cobrancas.find((c:{id:string})=>c.id===cobrancaId);
    expect(bill.recebido).toBe(40.50);
    expect(bill.saldo).toBe(80);
    expect(bill.status).toBe('PARCIAL');

    const excess = await request(server).post(paymentsUrl).set(bearer)
      .send({valor:90,pagoEm:new Date().toISOString(),forma:'PIX'});
    expect(excess.status).toBe(400);
    const final = await request(server).post(paymentsUrl).set(bearer)
      .send({valor:80,pagoEm:new Date().toISOString(),forma:'BOLETO'});
    expect(final.status).toBe(201);
    const afterFull = await request(server).get('/saas/admin/financeiro').set(bearer);
    const paid = afterFull.body.cobrancas.find((c:{id:string})=>c.id===cobrancaId);
    expect(paid.status).toBe('PAGO');
    expect(paid.saldo).toBe(0);
    expect((await request(server).patch('/saas/admin/empresas/'+sampleCompanyId+'/cobrancas/'+cobrancaId+'/pagamento')
      .set(bearer).send({pago:false})).status).toBe(409);

    const attachment = await request(server).post(prefix + '/anexos')
      .set(bearer).field('tipo','BOLETO').field('cobrancaId',cobrancaId)
      .attach('arquivo',Buffer.from('%PDF-1.4\n%%EOF\n'),'boleto-qa.pdf');
    expect(attachment.status).toBe(201);
    const files = await request(server).get(prefix + '/anexos').set(bearer);
    expect(files.status).toBe(200);
    expect(files.body.some((a:{id:string})=>a.id===attachment.body.id)).toBe(true);
    const fetched = await request(server).get(prefix + '/anexos/' + attachment.body.id).set(bearer);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('application/pdf');
    expect((await request(server).get(prefix + '/anexos/' + attachment.body.id)).status).toBe(401);

    const blocked = await request(server).patch('/saas/admin/empresas/'+sampleCompanyId+'/inadimplencia')
      .set(bearer).send({inadimplente:true});
    expect(blocked.status).toBe(200);
    const grace = await request(server).post('/saas/admin/empresas/'+sampleCompanyId+'/liberar-acesso')
      .set(bearer).send({dias:3,motivo:'Acordo financeiro em validação.'});
    expect(grace.status).toBe(201);
    const audit = await request(server).get(prefix+'/historico').set(bearer);
    expect(audit.status).toBe(200);
    const actions = audit.body.map((event:{acao:string})=>event.acao);
    expect(actions).toContain('COBRANCA_CRIADA');
    expect(actions).toContain('PAGAMENTO_REGISTRADO');
    expect(actions).toContain('ANEXO_FINANCEIRO');
    expect(actions).toContain('BLOQUEIO_FINANCEIRO');
    expect(actions).toContain('LIBERACAO_TEMPORARIA');
  });

  it('prepara mensalidade somente para clientes opt-in e evita duplicações na mesma competência', async () => {
    const server=app.getHttpServer();
    const token={Authorization:'Bearer '+reusedAdminToken};
    const plan=await db.plano.create({data:{nome:'Plano recorrência QA',precoMensal:149.90}});
    billingPlanId=plan.id;
    await db.empresa.update({where:{id:sampleCompanyId},data:{planoId:plan.id,status:'ATIVA'}});
    const configure=await request(server).patch('/saas/admin/financeiro/empresas/'+sampleCompanyId+'/recorrencia')
      .set(token).send({recorrente:true,diaVencimento:15});
    expect(configure.status).toBe(200);
    const endpoint='/saas/admin/financeiro/gerar-mensalidades';
    const first=await request(server).post(endpoint).set(token).send({competencia:'2026-12'});
    expect(first.status).toBe(201);
    expect(first.body.geradas).toBeGreaterThanOrEqual(1);
    const second=await request(server).post(endpoint).set(token).send({competencia:'2026-12'});
    expect(second.status).toBe(201);
    expect(second.body.geradas).toBe(0);
    const recs=await db.saasMensalidadeGerada.findMany({
      where:{empresaId:sampleCompanyId,competencia:'2026-12'},
      include:{cobranca:true},
    });
    expect(recs).toHaveLength(1);
    expect(Number(recs[0].cobranca.valor)).toBe(149.90);
    const invalid=await request(server).patch('/saas/admin/financeiro/empresas/'+sampleCompanyId+'/recorrencia')
      .set(token).send({recorrente:true,diaVencimento:31});
    expect(invalid.status).toBe(400);
  });

});
