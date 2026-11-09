# Auditoria funcional e de segurança — 09/11/2026

Este relatório documenta o que foi **executado e comprovado** em ambiente
descartável de CI, não é certificado de produção nem pentest.

## Backend

A branch `refactor/codigo-chatgpt` possui testes de integração HTTP contra
PostgreSQL 16 em `test/integration`:

- autenticação JWT por tenant e isolamento ao trocar `x-tenant`;
- primeiro login, alteração obrigatória de senha, revogação de sessão anterior;
- bloqueio de módulos desativados no SaaS;
- categorias, produtos, fornecedores, lotes, EAN e estoque;
- clientes, fiados, venda e recebimento em caixa;
- vasilhames retornáveis e conciliação de caixa;
- contas a pagar e a receber, gestão SaaS e privilégios;
- bloqueios de autorização de operadores para alterar preços, saldo de fiados,
  créditos, funcionário vinculado e caixa de outro operador;
- recibo de venda não fiscal e nenhuma emissão de NF-e/NFC-e.

Na execução `42656485458`, 21 testes de integração passaram em quatro
arquivos, além das etapas de build, lint, unitários, E2E e migrações.
Alterações posteriores foram submetidas ao CI novamente; conferir o commit
do último build antes de implantar.

## Integração frontend–backend real

O workflow do frontend `.github/workflows/full-stack-e2e.yml` cria um banco
PostgreSQL descartável, aplica as migrações, cadastra `bebfybdteste`,
sobe a API NestJS e o frontend e executa Chromium desktop e mobile com Playwright.

Os cenários cobrem:

- primeira senha e ativação;
- categorias, produtos e clientes reais via formulário e API;
- PDV, pagamento em dinheiro, fiado e comprovante não fiscal;
- recebimento de fiado e contas financeiras;
- confirmação de login simultâneo (não/sim), expulsão do token anterior;
- acesso administrativo SaaS com conta explicitamente autorizada;
- menu, produtos e PDV na largura de celular;
- CORS: autorização para HTTPS de subdomínio válido e rejeição de origem
  externa, HTTP e subdomínio aninhado.

Execuções aprovadas incluem `42655431754` e `42656667452` do
repositório `Bebfy-Tech/bebfy-frontend`. Os jobs usam banco **efêmero**,
sem ligação com dados de clientes ou com a hospedagem definitiva.

## Dependências e risco de produção

O lock original do backend tinha 39 vulnerabilidades npm:
5 baixas, 16 moderadas, 14 altas e 4 críticas; **17** afetavam
a árvore de produção (7 moderadas, 9 altas e 1 crítica).

Uma atualização validada em PostgreSQL, com bcrypt 6, fast-xml-parser 5 e
correções de versão compatíveis, foi aplicada na branch de refatoração.
Depois dela, a auditoria do ambiente de produção reportou
**13 avisos (6 moderados, 7 altos, 0 críticos)**.

**O risco continua aberto.** As bibliotecas legadas do NestJS 10 e suas
dependências exigem uma migração de plataforma planejada, não `npm audit
fix --force` sem compatibilização. A versão de produção só pode ser
aprovada após tratamento/revisão formal dessas dependências.

O frontend também apresenta avisos npm moderados na árvore completa
de dependências; executar auditoria com `npm audit --omit=dev` e atualizar
as dependências conforme compatibilidade validada.

## Pendências fora do CI

1. Validação de deploy, proxy reverso, DNS wildcard, HTTPS e CORS na
   hospedagem efetiva, não apenas em localhost.
2. Conferir a existência e cadastrar `bebfybdteste` no **PostgreSQL real de
   homologação** (o seed no CI não se propaga para a nuvem do usuário).
3. Testar navegador real em Windows, Android, impressão de cupom,
   disponibilidade intermitente, desempenho sob carga e emissão não fiscal.
4. Criptografar CPF/CNPJ em repouso com migração gradual, chaves fora do DB,
   índices cegos e rotação; atualmente são legíveis nas tabelas legadas.
5. Revisão de dependências restantes, atualização segura do NestJS e
   validação de backups/restore, observabilidade e pentest.
6. Testar planos/módulos em todas as combinações comerciais habilitadas.
7. Confirmar que NF-e e NFC-e **continuam desativadas**, conforme escopo.

## Decisão

**Aprovado para homologação funcional com banco descartável e API real.**
**Não aprovado para rotular como “100% seguro / produção pronta”** por
pendências de dependências, criptografia de documentos e infraestrutura.
