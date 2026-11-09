# Bebfy — Segurança de credenciais, documentos e suporte

## Estado confirmado da branch

- A API **não possui senha universal, código 0 ou bypass de login de clientes**.
  Nunca criar uma credencial compartilhada que autentique como qualquer funcionário.
- As senhas cadastradas pela aplicação são guardadas via **bcrypt.hash(senha, 12)**.
  A autenticação usa `bcrypt.compare`. A coluna `Usuario.senha` armazena o hash,
  e não a senha original. O bcrypt é uma função de hash, não criptografia reversível.
- Scripts demonstrativos antigos com senha fixa foram corrigidos para usar
  variáveis de ambiente, com execução de produção bloqueada. Se essas senhas
  foram usadas em bancos existentes, resetar imediatamente as contas afetadas.
- `JWT_SECRET` passou a exigir ao menos 32 caracteres. A força deve vir de
  um segredo aleatório gerado por gerenciador seguro, não de uma frase previsível.
- O acesso global SaaS requer JWT válido e identidade explicitamente presente em
  `SAAS_ADMIN_USER_IDS`; não basta cargo de administrador de uma loja.
- CPF de funcionário, CPF/CNPJ de cliente e CNPJ da empresa **ainda são strings
  legíveis no banco**. O bcrypt não cobre esses campos. Também revisar
  telefones, endereços, logs e backups, que podem conter informações pessoais.

## Fluxo atual de suporte seguro (somente diagnóstico)

Rotas, acessíveis apenas com JWT de superadministrador SaaS:

1. `POST /saas/admin/suporte/sessoes`
   ```json
   {
     "empresaId": 1,
     "motivo": "Cliente pediu apoio para diagnosticar o caixa",
     "ticket": "SUP-123",
     "consentimentoConfirmado": true
   }
   ```
   Retorna identificador da sessão e expiração em **15 minutos**.
2. `GET /saas/admin/suporte/sessoes/:id/diagnostico`:
   somente situação da empresa e contagens agregadas de produtos,
   funcionários, clientes, caixas abertos e vendas; sem senhas ou CPF.
3. `POST /saas/admin/suporte/sessoes/:id/encerrar`: revoga acesso imediatamente.

O administrador precisa estar autenticado, ter o ID autorizado no servidor,
informar chamado/motivo e confirmar o consentimento do cliente (declaração
auditável, não prova independente de consentimento). O backend valida
administrador, sessão, expiração e revogação. Início, consulta e encerramento
geram registros na tabela `logs_auditoria` com empresa, ator e ticket.

**Não é impersonação de usuário.** Não permite criar vendas, alterar dados,
ler CPF, baixar documentos nem acessar telas operacionais do cliente como
se fosse ele. Para suporte interativo futuro, exigir autorização explícita
do responsável pela empresa, escopo de permissões restrito, expiração,
revogação, visibilidade do aviso na interface e logs por ação. Não
usar senha master ou ignorar o JWT/tenant.

## Roteiro seguro de criptografia de CPF/CNPJ — ainda pendente

A criptografia de campo **não foi ativada** automaticamente porque
existem dados e índices legados, login de funcionários por CPF, buscas de
clientes e restrições únicas `(empresaId, cpf)` e
`(empresaId, cpfCnpj)`. Criptografar a string existente diretamente
impediria pesquisas e poderia provocar perda de acesso ou duplicações.

Migração planejada para homologação:

1. Garantir backups testados e inventariar dados/valores duplicados.
2. Criar colunas novas para **ciphertext AES-256-GCM** (IV aleatório
   exclusivo por valor, tag de autenticação e ID/versão de chave) e
   um **índice cego HMAC-SHA-256** derivado de CPF normalizado
   e chave de indexação separada. Quando necessário, incluir empresaId
   no HMAC para reduzir correlação entre lojas. Não usar SHA-256
   simples para documentos, que têm espaço de busca pequeno.
3. Implementar leitura dupla temporária e escrita criptografada,
   protegendo igualmente funcionário, cliente, empresa e ConfigGlobal,
   sem expor documentos nos logs ou nos endpoints de suporte.
4. Fazer backfill em lotes, verificar contagens e unicidade,
   construir índices únicos por tenant, migrar filtros de login
   e pesquisa para o índice cego.
5. Validar nos testes de banco e no frontend: CPF login,
   cadastro, edição, duplicatas, performance, rotação de chaves,
   backups e restauração.
6. Remover colunas legadas em texto **apenas após** confirmação
   de todas as leituras e um período seguro de transição.
7. Gerenciar chaves fora do banco, em KMS/cofre, com acesso mínimo,
   rotação, recuperação segura e segregação entre ambientes.

Até concluir a migração, restringir consulta aos documentos por papel,
criptografar disco e backups, usar TLS para a conexão com o banco e
registrar qualquer acesso privilegiado a dados pessoais. Não considerar
CPF/CNPJ criptografados enquanto as colunas atuais existirem em claro.

## Validação

```bash
npm ci
npm run build
npm run lint
npm test
npm run test:e2e
# banco PostgreSQL de teste, com migrações aplicadas:
npm run test:integration
```

Os testes de suporte cobrem consentimento obrigatório, janela de expiração,
revogação, usuário não autorizado, auditoria e resposta sem dados pessoais.
A integração executa contra PostgreSQL 16 isolado no GitHub Actions.
Isso não substitui um pentest nem a revisão de infraestrutura real.
