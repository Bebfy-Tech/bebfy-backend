import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const senhaInicial = process.env.BEBFY_BOOTSTRAP_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Script legado de bootstrap não pode ser executado em produção.');
  }
  if (!senhaInicial || senhaInicial.length < 12) {
    throw new Error('Configure BEBFY_BOOTSTRAP_ADMIN_PASSWORD (mínimo 12 caracteres).');
  }
  const senhaHash = await bcrypt.hash(senhaInicial, 12);

  // 1. Cria o funcionário (forçando a conversão de tipo para ignorar o cache do TS)
    // src/criar-usuario.ts
  const funcionario = await prisma.funcionario.create({
    data: {
      nome: 'Administrador Bebfy',
      cpf: '00000000000',
      cargo: 'ADMINISTRADOR', // Precisa ser um valor válido do Enum Cargo
      empresaId: 1,
    },
  });

  // 2. Cria o usuário associado
  const usuario = await prisma.usuario.create({
    data: {
      email: 'admin@bebfy.com',
      senha: senhaHash,
      funcionarioId: funcionario.id,
      permissoes: ['ADMIN'],
    },
  });

  console.log('✅ Usuário criado com sucesso:', usuario.email);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar usuário:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
