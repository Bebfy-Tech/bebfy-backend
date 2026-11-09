import { PrismaClient, SaasCargo } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SAAS_ALLOW_PROVISION !== 'true') {
    throw new Error('Provisionamento em produção exige autorização explícita.');
  }
  for (const codigo of [1, 2]) {
    const senha = process.env['SAAS_ADMIN_' + codigo + '_PASSWORD'];
    if (!senha || senha.length < 12) throw new Error('Defina SAAS_ADMIN_' + codigo + '_PASSWORD com pelo menos 12 caracteres.');
    const nome = process.env['SAAS_ADMIN_' + codigo + '_NAME'] || 'Administrador ' + codigo;
    const existente = await db.saasOperador.findUnique({ where: { codigo } });
    if (existente) {
      if (existente.cargo !== SaasCargo.SUPER_ADMIN) throw new Error('Código ' + codigo + ' já utilizado por colaborador.');
      console.log('Administrador ' + codigo + ' já existente; senha preservada.');
      continue;
    }
    await db.saasOperador.create({
      data: { codigo, nome, senha: await bcrypt.hash(senha, 12), cargo: SaasCargo.SUPER_ADMIN, permissoes: ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS'] },
    });
    console.log('Administrador ' + codigo + ' criado.');
  }
}
void main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
