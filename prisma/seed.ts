import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.BEBFY_ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Seed de dados demonstrativos bloqueado. Use BEBFY_ALLOW_DEMO_SEED=true somente em homologação.');
  }
  console.log('🌱 Executando seed de inicialização...');

  const empresa = await prisma.empresa.upsert({
    where: { slug: 'matriz' },
    update: {
      subdominio: 'matriz',
      razaoSocial: 'Distribuidora Matriz LTDA',
      nomeFantasia: 'Distribuidora Matriz',
      status: 'ATIVA',
    },
    create: {
      razaoSocial: 'Distribuidora Matriz LTDA',
      nomeFantasia: 'Distribuidora Matriz',
      subdominio: 'matriz',
      slug: 'matriz',
      cnpj: '00000000000191',
      status: 'ATIVA',
    },
  });

  console.log(`✅ Empresa de teste verificada/criada: ${empresa.nomeFantasia}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });