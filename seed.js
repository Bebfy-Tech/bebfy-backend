const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const plano = await prisma.plano.create({
    data: { nome: 'Varejo Pro', tipo: 'VAREJO_PRO', precoMensal: 149.90 },
  });

  const empresa = await prisma.empresa.create({
    data: {
      nomeFantasia: 'Bebfy Matriz',
      razaoSocial: 'Bebfy Distribuidora LTDA',
      cnpj: '12345678000199',
      slug: 'matriz',
      status: 'ATIVA',
      planoId: plano.id,
    },
  });

  const modulos = ['CAIXA_PDV', 'FIADOS', 'ESTOQUE_LOTES', 'COMPRAS_FORNECEDORES', 'RELATORIOS_AVANCADOS'];
  await prisma.empresaModulo.createMany({
    data: modulos.map((m) => ({ empresaId: empresa.id, modulo: m, ativo: true })),
  });

  const funcionario = await prisma.funcionario.create({
    data: {
      empresaId: empresa.id,
      nome: 'Administrador Bebfy',
      cpf: '00000000000',
      cargo: 'ADMINISTRADOR',
    },
  });

  const senhaHash = await bcrypt.hash('123456', 10);
  await prisma.usuario.create({
    data: {
      email: 'admin@bebfy.com',
      senha: senhaHash,
      funcionarioId: funcionario.id,
      permissoes: ['ALL'],
    },
  });

  console.log('✅ Banco local populado com sucesso! Empresa ID:', empresa.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
