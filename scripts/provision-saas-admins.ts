import { PrismaClient, SaasCargo } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { emitKeypressEvents } from 'node:readline';

const db = new PrismaClient();
const PERMISSIONS = ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS', 'SUPORTE'];

function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Terminal interativo indisponível. Defina SAAS_ADMIN_1_PASSWORD e SAAS_ADMIN_2_PASSWORD no ambiente.');
  }
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let answer = '';
    let completed = false;
    const finish = (err?: Error) => {
      if (completed) return;
      completed = true;
      stdin.removeListener('keypress', keypress);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write('\n');
      if (err) reject(err);
      else resolve(answer);
    };
    const keypress = (str: string, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key.name === 'return' || key.name === 'enter') { finish(); return; }
      if (key.ctrl && key.name === 'c') { finish(new Error('Cadastro cancelado.')); return; }
      if (key.name === 'backspace') { answer = answer.slice(0, -1); return; }
      if (key.ctrl || key.name === 'escape' || key.name === 'tab' || key.name === 'delete') return;
      if (str && !str.includes('\u001b') && !str.includes('\r') && !str.includes('\n')) answer += str;
    };
    emitKeypressEvents(stdin);
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('keypress', keypress);
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SAAS_ALLOW_PROVISION !== 'true') {
    throw new Error('Provisionamento em produção exige autorização explícita.');
  }
  console.log('Bebfy — criação dos administradores centrais (códigos 1 e 2)');
  for (const codigo of [1, 2]) {
    const existente = await db.saasOperador.findUnique({ where: { codigo } });
    if (existente) {
      if (existente.cargo !== SaasCargo.SUPER_ADMIN) throw new Error('Código ' + codigo + ' já utilizado por colaborador.');
      console.log('Administrador ' + codigo + ' já existente. Senha preservada.');
      continue;
    }
    const envName = 'SAAS_ADMIN_' + codigo + '_PASSWORD';
    const senha = process.env[envName] || await promptHidden('Defina a senha do administrador ' + codigo + ': ');
    if (!senha) throw new Error('A senha do administrador ' + codigo + ' não pode ser vazia.');
    const nome = process.env['SAAS_ADMIN_' + codigo + '_NAME'] || 'Administrador ' + codigo;
    await db.saasOperador.create({
      data: {
        codigo, nome, senha: await bcrypt.hash(senha, 12),
        cargo: SaasCargo.SUPER_ADMIN, permissoes: PERMISSIONS,
      },
    });
    console.log('Administrador ' + codigo + ' cadastrado com sucesso.');
  }
  console.log('Concluído. Acesse /SaaS/admin e utilize os códigos 1 e 2.');
}
void main()
  .catch(e => { console.error('Erro:', e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
