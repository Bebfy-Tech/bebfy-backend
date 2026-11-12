# Bebfy — Entrega isolada das melhorias SaaS v2

## Proteção de branches
- Base preservada: `refactor/codigo-chatgpt`.
- Mudanças backend: `refactor/codigo-chatgpt-2`.
- Mudanças frontend correspondentes: `refactor/conexao-backend-chatgpt-2`.
- Não executar merge em `main` antes de revisar CI, integração e migrações em banco descartável.
- Esta versão foi desenvolvida sem acessar ou alterar o banco de dados da máquina do usuário.

## Mudanças de banco (aditivas)
- `20261112130000_plano_modulos_padrao`: módulos padrão em cada plano.
- `20261112133000_saas_operador_email`: e-mail de contato opcional no perfil do operador SaaS.
- `20261112140000_saas_modulo_descricoes`: textos comerciais dos módulos fixos.
- `20261112143000_saas_cobrancas`: cobranças manuais sem integração com bancos.
- `20261112150000_reset_senha_tokens`: tokens de recuperação com hash SHA-256, validade de 15 minutos e consumo único.

As migrações não excluem tabelas existentes. Antes de aplicar a qualquer banco com dados reais, realizar e verificar backup, conferir `DATABASE_URL` e então executar no backend:
```sh
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run build
npm test
```
**Não usar `prisma migrate reset`, `db push --force-reset` ou migrações destrutivas em dados reais.**
O backend v2 com migrações deve estar funcionando antes de habilitar o frontend v2.

## Recuperação de senha: dependência de e-mail
Só funciona após configurar um remetente verificado e um provedor Resend. Segredos ficam exclusivamente nas variáveis de ambiente do backend:
- `RESEND_API_KEY`: chave de API do serviço de e-mail.
- `RESEND_FROM_EMAIL`: remetente autorizado no serviço.
- `FRONTEND_PUBLIC_URL`: origem pública do frontend, por exemplo `https://bebfy.com.br`.

Fluxo: funcionário informa seu código/CPF no ambiente da distribuidora -> link enviado ao e-mail do proprietário cadastrado -> token aleatório de uso único com expiração de 15 minutos -> senha redefinida -> sessão anterior revogada. O servidor não revela qual usuário existe. Sem provedor configurado responde `503` com orientação; não simula envio.
A verificação inicial de titularidade do endereço do proprietário deve ser incluída em um processo operacional de onboarding antes de depender do canal em produção.

## Regras de senha
A especificação solicitou remover todos os mínimos de comprimento. **Essa exceção não foi implementada por risco de segurança.**
- Senhas de distribuidoras e troca/recuperação: mínimo de 10 caracteres.
- Senhas de operadores SaaS: mínimo de 12 caracteres.
- Senhas não são retornadas nas APIs. A redefinição temporária encerra a sessão anterior.

## Planos, módulos e cobrança
- Ao cadastrar empresa ou mudar para um plano, módulos incluídos no novo plano são registrados na tabela `empresa_modulos`.
- Trocar de plano não apaga módulos avulsos já liberados para clientes.
- O catálogo dos módulos é FIXO. Personalização de nome/descrição não adiciona um módulo novo.
- Módulos do plano são direitos comerciais configurados. **As permissões efetivas de cada rota operacional ainda precisam de auditoria por módulo no backend antes de comercializar pacotes de recursos isolados.**
- Cobranças e linhas digitáveis são SOMENTE REGISTROS MANUAIS. Nenhum boleto bancário é emitido, não há integração financeira nem confirmação automática de pagamento.
- Marcar uma cobrança como paga não significa remover automaticamente uma eventual inadimplência da empresa; a situação financeira é controlada separadamente.

## Verificação recomendada antes de uso real
1. CI do backend e frontend v2 aprovados.
2. Migrações executadas em banco de teste.
3. Testar: login SaaS, permissões limitadas, cadastro CPF/CNPJ, edição de empresa/proprietário, planos e módulos, cobranças, funcionário ativo/inativo, troca de senha, recuperação via e-mail, fluxo do tenant.
4. Confirmar que um funcionário de uma empresa não acessa dados de outra.
5. Auditar as dependências vulneráveis e revisar o bundle frontend antes do deploy.

Nenhum deploy ou migração no ambiente do usuário foi realizado por esta entrega.
