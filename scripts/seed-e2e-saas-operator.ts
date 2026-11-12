/** Creates an isolated SaaS operator only inside GitHub CI's throwaway database. */
import { PrismaClient, SaasCargo } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  if (process.env.CI !== 'true' || process.env.NODE_ENV === 'production') {
    throw new Error('This fixture is restricted to isolated CI environments.');
  }
  const code = Number(process.env.E2E_SAAS_CODE);
  const password = process.env.E2E_SAAS_PASSWORD || '';
  if (!Number.isInteger(code) || code <= 2 || password.length < 12) {
    throw new Error('Provide a valid CI-only SaaS administrator code and password.');
  }
  const prisma = new PrismaClient();
  try {
    await prisma.saasOperador.upsert({
      where: { codigo: code },
      create: {
        codigo: code,
        nome: 'Administrador CI módulo',
        senha: await bcrypt.hash(password, 12),
        cargo: SaasCargo.SUPER_ADMIN,
        permissoes: ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS', 'SUPORTE'],
        ativo: true,
      },
      update: { ativo: true },
    });
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
