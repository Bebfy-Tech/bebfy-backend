# 🚀 Bebfy Backend (NestJS + Prisma + PostgreSQL)

API Backend para a plataforma Bebfy com autenticação JWT e gestão de dados via Prisma ORM.

---

## 🛠️ 1. Configuração Inicial

```bash
# Instalar todas as dependências do projeto
npm install

# Atualizar e sincronizar a estrutura do banco PostgreSQL com o Prisma
npx prisma db push

 🚀 2. Iniciar o Servidor
bash
# Inicia a aplicação NestJS em modo de desenvolvimento na porta 3000
npm run start:dev

👤 3. Criar Utilizador Administrador de Teste
Bash
# Executa o script para cadastrar um funcionário e um utilizador admin com senha encriptada (bcrypt)
npx ts-node src/criar-usuario.ts
E-mail: admin@bebfy.com

Senha: 123456

🔑 4. Autenticação e Rotas Protegidas
Opção A: Via PowerShell
PowerShell
# 1. Realiza o login e guarda o 'access_token' retornado na variável $token
$resposta = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@bebfy.com","senha":"123456"}'
$token = $resposta.access_token

# 2. Acede à rota protegida enviando o token no cabeçalho 'Authorization'
Invoke-RestMethod -Uri "http://localhost:3000/auth/perfil" -Method Get -Headers @{ Authorization = "Bearer $token" }