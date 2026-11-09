# Bebfy — Ativação de usuários e sessão única por funcionário

## Subdomínios

Cada loja utiliza um `slug`/subdomínio único e é identificada pelo cabeçalho
`x-tenant` enviado pelo frontend. Isso não cria automaticamente registros DNS:
a hospedagem deve configurar domínio base, certificado HTTPS e roteamento.
A loja de QA usa `bebfybdteste` (nome exibido `bebfyBDteste`).
O cadastro no PostgreSQL real só ocorre quando executado no ambiente escolhido.

## Primeiro acesso

Na criação da loja, o proprietário recebe `codigo=1`, uma credencial inicial
e `primeiroAcesso=true`. Na configuração/reset de acesso de qualquer funcionário,
a mesma exigência é ativada novamente. A senha inicial é guardada como hash bcrypt.

`POST /auth/login` com `{ "login":"1", "senha":"..." }` e `x-tenant`
responde a **um** de três cenários:

- Sem sessão: `{ access_token, usuario, empresa }` (para usuário ativado).
- Primeiro acesso: `{ trocaSenhaObrigatoria: true, tokenTroca }`. Não recebe
  JWT para consumir os endpoints protegidos.
- Sessão ocupada com atividade recente: HTTP **409** com
  `codigo: "SESSAO_ATIVA"` e mensagem de confirmação. O frontend oferece
  os botões **Não** e **Sim, acessar**. Para assumir após confirmação,
  repete o login com `assumirSessao: true`.

Na primeira entrada, `POST /auth/primeiro-acesso/alterar-senha` exige
`tokenTroca`, `senhaAtual`, `novaSenha` e `confirmarNovaSenha`.
O token tem finalidade exclusiva de troca, expira em dez minutos e não é
aceito como bearer token para endpoints normais. A senha nova deve ser
diferente da atual e ter no mínimo dez caracteres. A troca é feita por
operação atômica, impedindo reuso.

## Sessão única e expulsão segura

Cada JWT contém `sessaoId`, gerado de forma aleatória a cada login.
`JwtStrategy` compara o ID do token com o ID vigente na tabela `Usuario`
em **todas** as rotas autenticadas. Um segundo login aceito substitui o ID
no banco e revoga o JWT antigo imediatamente do lado do servidor.

Para não tratar um navegador fechado como usuário online para sempre,
a sessão só é considerada **ocupada** quando houve atividade nos últimos
dois minutos. A estratégia atualiza o campo `ultimaAtividadeEm` quando
necessário. O frontend consulta `/auth/perfil` a cada 15 segundos e quando
a aba volta a ficar visível; o usuário anterior volta ao login quando
a verificação recebe 401. Como não há WebSocket, a desconexão da
**interface** pode demorar até a próxima consulta/polling, mas o acesso
ao backend é revogado no momento do novo login.

`POST /auth/logout` revoga a sessão atual. Alterar a senha de uma
sessão existente também revoga os tokens atuais, exigindo novo login.

## Senha inicial temporária em ambiente de QA

A conta de QA pode usar o código de login `1` e senha inicial curta
somente quando o script de teste recebe
`BEBFY_ALLOW_WEAK_DEMO_PASSWORD=true`, `BEBFY_ALLOW_TEST_COMPANY=true`
e `NODE_ENV=development`, em banco totalmente separado. O primeiro
login exige mudar imediatamente essa senha. Este modo não funciona em
`NODE_ENV=production`.

**Nunca use uma senha compartilhada e previsível em todos os clientes reais.**
A API SaaS requer senha inicial individual, com ao menos dez caracteres,
informada no cadastro. Para operação real, usar provisionamento de segredo
aleatório e envio por canal autenticado/seguro, sem incluir segredo em
URLs, commits ou logs.

## Migração em bancos existentes

`20261109180000_login_session_first_access` adiciona:
`Usuario.primeiroAcesso` (padrão false),
`Usuario.sessaoId` (nullable),
`Usuario.ultimaAtividadeEm` (nullable).
Usuários existentes mantêm seus hashes antigos e passam a ter sessão
única a partir do próximo login. Tokens JWT emitidos antes dessa mudança
deixarão de ser aceitos, pois não possuem `sessaoId`. Isso é intencional,
mas requer comunicação aos operadores antes do deploy.

Verificar em homologação antes de executar migrações no ambiente real.
