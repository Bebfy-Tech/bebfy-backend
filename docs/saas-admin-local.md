# Administração central do SaaS Bebfy — homologação local

O painel `/SaaS/admin` é independente das contas das distribuidoras. Códigos `1` e `2` são reservados para os administradores gerais. Não há senhas gravadas no repositório.

## Preparar o banco local (PowerShell)

Após configurar `DATABASE_URL` e `JWT_SECRET` para um banco PostgreSQL **de homologação**, execute na raiz do backend:

```powershell
npm ci
npx prisma migrate deploy
npx prisma generate

$env:SAAS_ADMIN_1_PASSWORD = 'SUBSTITUA_POR_SENHA_FORTE_1'
$env:SAAS_ADMIN_2_PASSWORD = 'SUBSTITUA_POR_SENHA_FORTE_2'
$env:SAAS_ADMIN_1_NAME = 'Administrador 1'
$env:SAAS_ADMIN_2_NAME = 'Administrador 2'
npm run dev:provision-saas-admins
npm run start:dev
```

As senhas devem ter pelo menos 12 caracteres. O provisionamento é idempotente: **não troca senhas de contas já existentes**. Para alterar senhas depois, utilize um fluxo administrativo de recuperação segura; não modifique hashes diretamente.

## Frontend

No frontend configure `VITE_API_URL=http://localhost:3000` e execute `npm run dev`. Acesse `http://localhost:5173/SaaS/admin`.

- Código `1`: primeiro administrador.
- Código `2`: segundo administrador.
- Aba **Funcionários do SaaS**: cadastre colaboradores com código a partir de `3`, senha de no mínimo 12 caracteres e permissões específicas.
- O colaborador **não é** funcionário de uma distribuidora e não recebe acesso a dados de lojas sem a permissão correspondente.
- Desativar um colaborador revoga seu token imediatamente.

Não exponha os códigos de provisionamento ou suas senhas em arquivos rastreados pelo Git. Após publicar o SaaS, ative HTTPS, credenciais exclusivas e um processo formal de recuperação/rotação de senhas.
