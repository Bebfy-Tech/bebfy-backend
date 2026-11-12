# Bebfy — Central Financeira SaaS v2

## Branches protegidas
- Backend **somente** `refactor/codigo-chatgpt-2`; não alterar `refactor/codigo-chatgpt` nem `main`.
- Frontend **somente** `refactor/conexao-backend-chatgpt-2`; não alterar a versão original.
- Nenhuma migração foi executada no banco do computador do usuário.

## Recursos entregues
- Nova opção de menu **Financeiro e Cobranças** no SaaS Admin, acessível por superadministradores e operadores com permissão EMPRESAS.
- Visão consolidada de valores previstos, pagos, abertos e vencidos, por cobranças cadastradas (não é faturamento bancário).
- Fichas financeiras individuais, pesquisa, filtros, histórico, contas em aberto e exportação CSV.
- Lançamentos manuais de cobranças com valor, vencimento, referência, linha digitável e observações.
- Pagamentos parciais e totais, com data, forma, operador, auditoria e controle de saldo. O banco usa trava de linha para evitar pagamentos simultâneos acima do saldo.
- Cobranças legadas marcadas como pagas continuam consideradas quitadas. O endpoint legado de marcar pago não modifica cobranças com registros parciais.
- Bloqueio por inadimplência e retirada de bloqueio; liberação de **1 a 90 dias** com justificativa e histórico. As guardas do backend continuam validando o bloqueio também em sessões autenticadas.
- Documentos financeiros privados PDF, PNG e JPG (até 2 MiB), gravados no PostgreSQL, protegidos pelas rotas administrativas e retornados com `Content-Disposition: attachment` e `nosniff`.

## Migrações novas (aditivas)
- `20261112160000_saas_financeiro_ledger`: tabelas `saas_pagamentos` e `saas_financeiro_eventos`.
- `20261112170000_saas_anexos_financeiros`: tabela `saas_anexos_financeiros`.

Estas migrações não apagam cobranças pré-existentes. Antes de instalar localmente:
1. Confirmar a `DATABASE_URL` e realizar backup validado com `pg_dump`.
2. Atualizar o backend **v2**, executar `npm ci`, `npx prisma migrate status`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run build`.
3. Atualizar o frontend **v2**, executar `npm ci`, `npm run build` e então os servidores.
4. Validar os testes HTTP, login SaaS, permissões restritas, upload/download, pagamentos parciais e bloqueios antes de produção.

**Nunca** executar `prisma migrate reset` ou `db push --force-reset` no banco com dados reais.

## Limitações conscientes
- Não há integração com banco, geração real de boleto, verificação de Pix, envio automático ao cliente ou conciliação automática.
- Mensalidades **não** são lançadas automaticamente todos os meses: precisam ser registradas manualmente. A soma do valor dos planos não representa valores recebidos.
- Documentos são limitados a 2 MiB e armazenados dentro do PostgreSQL; avaliar armazenamento privado dedicado antes de grande escala.
- O histórico detalhado passa a existir a partir das ações dessa versão. Eventos anteriores não são inventados.
- Não há cancelamento/estorno detalhado de pagamentos parciais; corrigir lançamentos incorretos requer fluxo administrativo adicional antes de uso financeiro crítico.
- A plataforma precisa de uma verificação humana de ponta a ponta no ambiente de homologação antes de liberar clientes reais.
