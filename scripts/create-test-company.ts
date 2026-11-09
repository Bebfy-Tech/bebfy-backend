import { PrismaClient, StatusEmpresa, TipoPlano } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const nome = 'bebfyBDteste';
const slug = 'bebfybdteste';

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error('Configure ' + nome + ' no ambiente de homologação.');
  return valor;
}

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.BEBFY_ALLOW_TEST_COMPANY !== 'true') {
    throw new Error('Cadastro exclusivo de desenvolvimento/homologação. Defina BEBFY_ALLOW_TEST_COMPANY=true.');
  }

  const cnpj = obrigatoria('BEBFY_TEST_CNPJ').replace(/\D/g, '');
  const cpf = obrigatoria('BEBFY_TEST_OWNER_CPF').replace(/\D/g, '');
  const email = obrigatoria('BEBFY_TEST_OWNER_EMAIL').toLowerCase();
  const senha = obrigatoria('BEBFY_TEST_OWNER_PASSWORD');
  const telefone = obrigatoria('BEBFY_TEST_PHONE');
  const responsavel = obrigatoria('BEBFY_TEST_OWNER_NAME');
  if (!/^\d{14}$/.test(cnpj)) throw new Error('BEBFY_TEST_CNPJ precisa ter 14 dígitos.');
  if (!/^\d{11}$/.test(cpf)) throw new Error('BEBFY_TEST_OWNER_CPF precisa ter 11 dígitos.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('BEBFY_TEST_OWNER_EMAIL inválido.');
  const senhaCurtaTeste = process.env.BEBFY_ALLOW_WEAK_DEMO_PASSWORD === 'true' &&
    process.env.NODE_ENV !== 'production' && senha === '12345';
  if (senha.length < 12 && !senhaCurtaTeste) {
    throw new Error('Use senha de pelo menos 12 caracteres. A senha curta 12345 só é autorizada explicitamente no teste local isolado.');
  }

  // Never silently change a company that might already have been created through the SaaS UI.
  const existente = await prisma.empresa.findUnique({ where: { slug } });
  if (existente) {
    console.log('Empresa já existente:', { id: existente.id, slug: existente.slug, status: existente.status });
    console.log('Nenhuma alteração feita. Cadastre acessos adicionais pelo painel de funcionários.');
    return;
  }

  const colisao = await prisma.empresa.findFirst({ where: { OR: [{ cnpj }, { subdominio: slug }] } });
  if (colisao) throw new Error('CNPJ ou subdomínio já usado por outra empresa.');
  const emailEmUso = await prisma.usuario.findUnique({ where: { email } });
  if (emailEmUso) throw new Error('E-mail do usuário já cadastrado.');

  const hash = await bcrypt.hash(senha, 12);
  const criado = await prisma.$transaction(async (tx) => {
    let plano = await tx.plano.findFirst({ where: { nome: 'Bebfy Teste' } });
    if (!plano) {
      plano = await tx.plano.create({
        data: { nome: 'Bebfy Teste', tipo: TipoPlano.VAREJO_PRO, precoMensal: 99 },
      });
    }
    const empresa = await tx.empresa.create({
      data: {
        nomeFantasia: nome, razaoSocial: 'Empresa de testes Bebfy',
        cnpj, subdominio: slug, slug, planoId: plano.id,
        status: StatusEmpresa.EM_TESTE,
      },
    });
    await tx.configGlobal.create({
      data: { empresaId: empresa.id, nomeEmpresa: nome, cnpj, telefone },
    });
    const funcionario = await tx.funcionario.create({
      data: {
        empresaId: empresa.id, codigo: 1, nome: responsavel, cpf, telefone,
        cargo: 'PROPRIETARIO',
        usuario: {
          create: { email, senha: hash, ativo: true, permissoes: [], primeiroAcesso: true },
        },
      },
      select: { id: true, codigo: true, usuario: { select: { id: true } } },
    });
    return { empresa, plano, funcionario };
  });

  console.log('Empresa de homologação criada:', {
    id: criado.empresa.id,
    nome: criado.empresa.nomeFantasia,
    slug: criado.empresa.slug,
    status: criado.empresa.status,
    plano: criado.plano.nome,
    codigoLogin: criado.funcionario.codigo,
    // Do not print passwords, CPF, CNPJ or email.
    usuarioIdParaAutorizacaoSaasOpcional: criado.funcionario.usuario?.id,
  });
  console.log('Senha não exibida. Acesse /login com x-tenant=' + slug + ' e o código do operador.');
}

void main()
  .catch(() => {
    console.error('Não foi possível cadastrar a distribuidora de testes. Confira variáveis e unicidade no banco. Dados confidenciais não serão exibidos.');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
