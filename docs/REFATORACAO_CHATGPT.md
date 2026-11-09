# Bebfy Backend — Refatoração ChatGPT

> Status: branch de desenvolvimento/homologação. Não executar migração em produção nem
> fazer merge sem revisão dos riscos abaixo.

## Arquitetura

- NestJS 10 / Prisma 5 / PostgreSQL 16.
- JWT com isolamento por empresa. Requisições autenticadas exigem token e correspondência de tenant.
- Admin SaaS protegido por allowlist **SAAS_ADMIN_USER_IDS**; administrador de uma loja
  não recebe autorização de administrador da plataforma.
- O login exige identificação da loja por subdomínio ou cabeçalho **x-tenant**.
- Empresas `ATIVA` e `EM_TESTE` podem acessar a aplicação; `SUSPENSA` e `CANCELADA` são bloqueadas.
- Senhas de funcionários são armazenadas com bcrypt e não retornam nos endpoints de acesso.

## Configuração essencial

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/bebfy?schema=public
JWT_SECRET=uma-chave-forte-gerada-para-producao
FRONTEND_URL=https://app.seudominio.com.br
SAAS_ADMIN_USER_IDS=uuid-usuario-admin-plataforma
```

Não reutilizar os valores de teste do GitHub Actions em ambientes reais.
Configurar HTTPS, segredos em cofre e política de backup/restauração.

## APIs adicionadas/estendidas

- `POST /funcionarios/:id/acesso` configura e-mail, senha, código e permissões de um funcionário;
  exige cargo de gestão e respeita hierarquia de cargos.
- `/financeiro/contas-pagar`, `/financeiro/contas-receber` e `/financeiro/resumo`
  oferecem lançamentos, status e totalizações básicas de contas.
- **Módulo NF-e/NFC-e desativado nesta fase**. Não existem rotas fiscais ativas nem emissão de documentos oficiais.
  A entrada XML experimental permanece fora do `AppModule` e não está acessível pela API.
- `GET /vendas/:id/comprovante` devolve um JSON de **comprovante comercial não fiscal**, sem chave ou protocolo fiscal, para futura impressão no frontend.
- `/saas/admin/*` ativa gestão de empresas, planos e módulos, somente para superadministradores
  explicitamente cadastrados na variável de ambiente.
- `/produtos/vasilhames/*` habilita controle de empréstimos e devoluções.

Permissões granulares para operadores: `VENDAS_CANCELAR`, `DELIVERY_ACERTAR`,
`CAIXA_FECHAR`, `CAIXA_MOVIMENTAR`, `FIADOS_LANCAR`, `FIADOS_RECEBER`,
`ESTOQUE_AJUSTAR`, `LOTES_REMOVER` e `VASILHAMES_MOVIMENTAR`.
Gestores/proprietários possuem acesso administrativo conforme seus cargos.

## Validação automática

```bash
npm ci
npx prisma validate
npm run build
npm run lint
npm test
npm run test:e2e
# Para integração, usar Postgres de testes já migrado:
npx prisma migrate deploy
npm run test:integration
```

O GitHub Actions usa PostgreSQL 16 isolado para aplicar as migrações e executar
testes de isolamento de tenant, concorrência de baixa de estoque e fechamento de caixa.
**Build verde não equivale à validação de produção com dados reais.**

## ALERTA: Migração de dados existente

A migração `20261109140000_schema_alignment` foi gerada pela diferença entre a
estrutura de um banco de testes vazio (migração inicial antiga) e o Prisma schema atual.
Ela altera colunas, relacionamentos e tipos e pode remover/recriar colunas legadas.

**Não execute `prisma migrate deploy` na produção existente sem:**

1. Backup verificável e teste de restauração.
2. Inventário do schema e dos dados do banco que já está em produção.
3. Plano de migração de dados/backfill para todas as novas relações obrigatórias
   `empresaId`, IDs e conversões de tipos.
4. Teste completo em cópia anonimizada de homologação, incluindo rollback planejado.
5. Janela de implantação e monitoramento pós-migração.

O campo `ItemVenda.unidadesEstoque` será preenchido em novas vendas para preservar
a quantidade física de fardos em eventuais cancelamentos. Vendas legadas sem esse
campo precisam de reconciliação manual; não há informação suficiente para reconstruir
automaticamente todas as baixas históricas.

## Limitações a validar antes de produção

- A emissão de NF-e/NFC-e e a verificação externa junto à SEFAZ **não fazem parte do escopo atual**. Não habilitar rotas fiscais sem projeto e homologação próprios.
- O módulo financeiro cobre contas manuais e totalizações; ainda não implementa
  conciliação bancária, lançamentos contábeis completos ou automação integral do PDV.
- Preços informados pelo cliente no PDV exigem uma política final de precificação
  e autorização de descontos; não tratar essa regra como concluída.
- Lotes necessitam baixa FEFO/rastreabilidade detalhada durante vendas para controle
  rigoroso de validade e saldo físico por lote.
- Fiado e cancelamentos com pagamentos já amortizados requerem fluxo formal de
  estorno/devolução; bloquear situações sem conciliação não substitui esse fluxo.
- É necessário ampliar os testes de permissões, fraude, operações concorrentes,
  recuperação de falhas e isolamento entre empresas.
- O frontend deve enviar `x-tenant` no login, configurando `VITE_TENANT_SLUG`; o serviço Axios e os contratos tipados estão na branch `refactor/conexao-backend-chatgpt` do repositório frontend.
- Monitoramento, backups operacionais, configuração DNS/HTTPS, dados reais e deploy
  devem ser validados no ambiente final antes do lançamento.
