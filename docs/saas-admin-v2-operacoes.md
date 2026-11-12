# Bebfy SaaS Admin v2 — Operações, financeiro e suporte

## Branches preservadas
- Backend de desenvolvimento: `refactor/codigo-chatgpt-2`
- Frontend de desenvolvimento: `refactor/conexao-backend-chatgpt-2`
- Não alterar as branches originais `refactor/codigo-chatgpt` e `refactor/conexao-backend-chatgpt`.

## Central de suporte manual
O WhatsApp é o canal de comunicação com os clientes. O Bebfy **não** recebe nem envia mensagens automaticamente. O operador administrativo abre uma ordem de serviço na tela **Central de suporte**, vinculada à distribuidora, e registra o histórico manualmente.

Campos da OS: número sequencial, distribuidora, assunto, descrição, contato, telefone, categoria, prioridade, status, responsável interno, indicação "Com Dev", desenvolvedor responsável, solução e datas.

Status aceitos: `PENDENTE`, `EM_ATENDIMENTO`, `AGUARDANDO_CLIENTE`, `COM_DEV`, `RESOLVIDO` e `CANCELADO`. A resolução exige descrição da solução. Eventos e interações ficam preservados. É possível anexar evidências PDF/JPG/PNG de até 3 MB com armazenamento privado no PostgreSQL; somente operadores autenticados e autorizados conseguem baixar.

As rotas `/saas/admin/suporte/*` exigem a permissão independente `SUPORTE`. Superadministradores têm acesso. Operadores comuns precisam receber a permissão no cadastro de funcionários SaaS. Endpoints auxiliares de consulta a empresas e operadores são limitados a identificador e nome, sem liberar acesso geral ao cadastro das empresas.

## Financeiro
A central financeira usa registros de cobrança sem integração com banco.
- Cadastro, consulta, anexos e pagamentos parciais.
- Inadimplência, bloqueio, desbloqueio e liberação temporária de 1 a 90 dias.
- Configuração de lançamento mensal por distribuidora: desativada por padrão, vencimento entre 1 e 28.
- Um administrador autorizado deve clicar em **Gerar mensalidades do mês**. Apenas distribuidoras `ATIVA`, opt-in, com plano e valor positivo são elegíveis.
- Unicidade `empresaId + competencia` evita gerar duas mensalidades da mesma competência.
- A operação gera uma cobrança administrativa interna, não um boleto bancário, não envia WhatsApp e não confirma pagamentos.
- O saldo de cobranças pagas no modelo anterior continua considerado no resumo; o novo livro de pagamentos detalhados impede quitações duplicadas.

## Dashboard, monitoramento e ficha 360º
O dashboard exibe indicadores e alertas derivados de registros reais, como cobranças vencidas, liberação financeira próxima do fim, OS urgentes e OS com o Dev. Acompanhamento de uso baseia-se na última atividade autenticada registrada, e não é uma checagem de uptime.

Na ficha da distribuidora, atalhos permitem ir a cobranças, suporte e edição do responsável. O relatório de monitoramento é protegido por permissão `EMPRESAS`.

## Auditoria
Ações administrativas bem-sucedidas realizadas por `POST`, `PATCH`, `PUT` e `DELETE` nas rotas protegidas do SaaS são registradas em `saas_auditoria`, com operador, rota, método, identificador de recurso e nomes de campos. Senhas, tokens e valores de payload **não** são armazenados na auditoria. A consulta do histórico exige `FUNCIONARIOS` e possui limite de exibição dos 1.000 eventos recentes. Eventos anteriores à instalação não podem ser reconstruídos.

## Aplicação local e homologação
Antes de atualizar o banco de dados de desenvolvimento, **realizar backup PostgreSQL** e conferir o estado das migrações. Em cada projeto local, alternar explicitamente para a respectiva branch v2 e executar `npm ci`. No backend: `npx prisma migrate deploy`, `npx prisma generate`, `npm run build` e testes. No frontend: `npm run build` e iniciar o Vite normalmente.

As migrações adicionadas pela implementação desta rodada:
- `20261112180000_saas_suporte_manual`
- `20261112190000_saas_mensalidades_recorrentes`
- `20261112200000_saas_suporte_anexos`
- `20261112210000_saas_auditoria`

O pipeline CI utiliza PostgreSQL descartável, não altera o banco do usuário. Validar em ambiente de homologação os cadastros, permissões, anexos, abertura/resolução de OS, pagamentos, bloqueios e lançamentos recorrentes antes de produção.

## Limitações e próximos cuidados
- Sem integração WhatsApp, banco, Pix, emissão oficial de boleto e NF-e.
- O painel usa filtros no cliente e limites de até 1.500 OS e 1.000 eventos de auditoria; implementar paginação no servidor para grandes volumes.
- Os anexos estão no PostgreSQL para simplificar homologação; em escala, considerar armazenamento privado de objetos com retenção, varredura antimalware e política de backup.
- A geração de mensalidades exige acionamento manual. Agendamento automático exigirá um processo dedicado, monitoramento de falhas e configuração explícita.
- Gestão de incidentes e atendimento continuam manuais; métricas de infraestrutura e erros de aplicação exigem ferramentas próprias.
