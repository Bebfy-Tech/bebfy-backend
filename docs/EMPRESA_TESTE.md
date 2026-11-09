# Empresa de homologação Bebfy

**Nome:** `bebfytesBDteste`  
**Subdomínio/slug:** `bebfytesbdteste`  
**Estado inicial:** `EM_TESTE`  
**Plano inicial:** `Bebfy Teste` (`VAREJO_PRO`, preço apenas demonstrativo de R$ 99/mês)  
**Código do primeiro operador proprietário:** `1`

O script de cadastro está em `scripts/create-test-company.ts`. Ele cria em **uma transação** a empresa, o plano, a configuração e o usuário proprietário, com senha armazenada em hash bcrypt (custo 12).

**IMPORTANTE:** os commits no GitHub **não criam automaticamente dados no banco da sua hospedagem**. Execute no ambiente de desenvolvimento/homologação, usando a `DATABASE_URL` desse banco, depois de aplicar migrações aprovadas. Não execute em produção.

## Pré-requisitos

- PostgreSQL de homologação inicializado.
- Node.js e dependências instaladas com `npm ci`.
- `DATABASE_URL` apontando somente para o banco de desenvolvimento/homologação.
- Migrações aplicadas com segurança nesse ambiente.
- Dados de teste para o responsável (não use CPF real ou senha compartilhada).

## Execução no Windows PowerShell

```powershell
$env:NODE_ENV = "development"
$env:BEBFY_ALLOW_TEST_COMPANY = "true"
$env:DATABASE_URL = "postgresql://usuario:senha@localhost:5432/bebfy_teste?schema=public"
$env:BEBFY_TEST_CNPJ = "<CNPJ de testes com 14 dígitos>"
$env:BEBFY_TEST_OWNER_CPF = "<CPF de testes com 11 dígitos>"
$env:BEBFY_TEST_OWNER_EMAIL = "<email único de testes>"
$env:BEBFY_TEST_OWNER_PASSWORD = "<senha forte e única de pelo menos 12 caracteres>"
$env:BEBFY_TEST_OWNER_NAME = "<nome fictício do proprietário>"
$env:BEBFY_TEST_PHONE = "<telefone de testes>"
npm run dev:create-test-company
```

No Linux/macOS, exporte as mesmas variáveis antes de executar `npm run dev:create-test-company`. O script **não registra** CPF, CNPJ, senha ou e-mail nos logs.

O script verifica se `bebfytesbdteste` já existe e não sobrescreve um cadastro anterior. Se o CNPJ, subdomínio ou e-mail já estiver vinculado a outra empresa, interrompe o cadastro.

## Acesso à loja

Com o frontend e backend apontando para o mesmo ambiente de homologação:

- No arquivo `.env.local` do **frontend**, use `VITE_TENANT_SLUG=bebfytesbdteste` e `VITE_API_URL` apontando ao NestJS.
- Acesse `/login`, digite o **código 1** e a senha definida em `BEBFY_TEST_OWNER_PASSWORD`.
- Acesse `/dashboard` e `/pdv` para iniciar os testes. Não há produtos ou vendas de exemplo: eles devem ser cadastrados pelos fluxos normais ou por uma carga de dados específica.

## Acesso à gestão do SaaS

O painel `/saas/acesso` já existe no código frontend. Para utilizá-lo, é necessário configurar a variável **servidor** `SAAS_ADMIN_USER_IDS` com o ID do registro `Usuario` do administrador autorizado. O script imprime o UUID do primeiro usuário criado, **mas não concede acesso global automaticamente**. Essa autorização precisa ser concedida conscientemente pelo administrador da infraestrutura.

A tela SaaS utiliza o slug `bebfytesbdteste` para autenticar o usuário, seguido da verificação de administrador global. Para testar sem conceder acesso global ao proprietário da distribuidora, use uma conta de administrador da plataforma separada.

## Estado do cadastro

Este arquivo e o script preparam o cadastro. **Não é comprovação de que o banco remoto já foi alimentado.** É necessário executar o script e verificar a resposta do banco desejado.
