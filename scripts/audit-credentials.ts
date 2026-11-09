import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Read-only security check. Never print hashes, secrets or user identifiers.
 * Run only with authorization to inspect the selected environment.
 */
async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: { senha: true },
  });
  const forte = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;
  let hashesBcrypt = 0;
  let hashesAbaixoCusto12 = 0;
  let valoresInseguros = 0;

  for (const usuario of usuarios) {
    const match = forte.exec(usuario.senha);
    if (!match) {
      valoresInseguros++;
      continue;
    }
    hashesBcrypt++;
    if (Number(match[1]) < 12) hashesAbaixoCusto12++;
  }

  console.log(JSON.stringify({
    totalUsuarios: usuarios.length,
    hashesBcrypt,
    hashesComCustoAbaixoDe12: hashesAbaixoCusto12,
    valoresSemHashBcryptValido: valoresInseguros,
    alerta: 'Auditoria apenas do formato armazenado: não valida senhas vazadas, CPF/CNPJ ou banco criptografado.',
  }, null, 2));

  if (valoresInseguros) process.exitCode = 1;
}

void main()
  .catch(() => {
    console.error('Auditoria não concluída. Verifique acesso ao banco; nenhum dado pessoal foi exibido.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
