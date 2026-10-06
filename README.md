🚀 Bebfy Backend — Guia Completo do Projeto
API Backend para a plataforma Bebfy, desenvolvida com NestJS, Prisma ORM, PostgreSQL, JWT e Bcrypt. Contém o fluxo completo de autenticação e o módulo de gestão de produtos.

🛠️ 1. Requisitos e Instalação de Dependências
Requisitos Prévios
Node.js (v18 ou superior)

PostgreSQL ativo na porta 5432 com a base de dados bebfy criada.

Git instalado.

Instalação Automática
Após clonar o repositório, instale todas as bibliotecas executando:

Bash
npm install
Bibliotecas Utilizadas no Projeto
Caso precise de as instalar manualmente, os pacotes dividem-se em:

Bash
# 1. Base de Dados e ORM (Prisma)
npm install @prisma/client
npm install -D prisma

# 2. Autenticação e Encriptação (JWT, Passport e Bcrypt)
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/bcrypt @types/passport-jwt

# 3. Mapeamento de DTOs e Execução de Scripts
npm install @nestjs/mapped-types class-validator class-transformer
npm install -D ts-node

⚙️ 2. Configuração do Ambiente (.env)
Crie um ficheiro chamado .env na raiz da pasta backend com o seguinte conteúdo:

Code snippet
# URL de Ligação ao PostgreSQL local (ajuste utilizador e senha se necessário)
DATABASE_URL="postgresql://postgres:suasenha@localhost:5432/bebfy?schema=public"

# Chave secreta para assinatura dos tokens JWT
JWT_SECRET="segredo_super_secreto_bebfy"

# Porta do servidor NestJS
PORT=3000

🗄️ 3. Sincronização da Base de Dados (Prisma)
Sincronize as tabelas do ficheiro prisma/schema.prisma (Usuario, Funcionario, Produto) com o PostgreSQL local e gere as tipagens do Prisma Client:

PowerShell
npx prisma db push

👤 4. Criação do Utilizador Administrador Inicial
Antes de efetuar o login na API, execute o script de bootstrap para criar o utilizador admin com a palavra-passe encriptada via bcrypt:

PowerShell
npx ts-node src/criar-usuario.ts
E-mail: admin@bebfy.com

Palavra-passe: 123456

🔑 5. Módulos e Rotas da API
Módulo de Autenticação (/auth)
POST /auth/login — Efetua o login e retorna o access_token JWT.

GET /auth/perfil — (Protegido por JWT) Retorna as informações do utilizador autenticado.

Módulo de Produtos (/produtos)
POST /produtos — (Protegido por JWT) Regista um novo produto.

GET /produtos — (Protegido por JWT) Lista todos os produtos ordenados pelos mais recentes.

GET /produtos/:id — (Protegido por JWT) Procura um produto por ID (UUID).

PATCH /produtos/:id — (Protegido por JWT) Atualiza um produto existente.

DELETE /produtos/:id — (Protegido por JWT) Elimina um produto.

Estrutura do DTO de Produto (CreateProdutoDto)
JSON
{
  "nome": "Cerveja Heineken 600ml",
  "precoVendaVarejo": 12.50,
  "estoqueAtual": 48,
  "retornavel": true,
  "unidadeMedida": "UN"
}

🧪 6. Script de Testes Rápidos (PowerShell)
Inicie o servidor em modo de desenvolvimento:

PowerShell
npm run start:dev
Numa nova janela do PowerShell, execute a sequência de testes:

PowerShell
# 1. Autenticação e obtenção do Token JWT
$resposta = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@bebfy.com","senha":"123456"}'
$token = $resposta.access_token

# 2. Testar rota protegida do Perfil
Invoke-RestMethod -Uri "http://localhost:3000/auth/perfil" -Method Get -Headers @{ Authorization = "Bearer $token" }

# 3. Criar um novo Produto
$novoProduto = '{"nome":"Cerveja Heineken 600ml","precoVendaVarejo":12.50,"estoqueAtual":48,"retornavel":true,"unidadeMedida":"UN"}'
Invoke-RestMethod -Uri "http://localhost:3000/produtos" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $novoProduto

# 4. Listar Produtos
Invoke-RestMethod -Uri "http://localhost:3000/produtos" -Method Get -Headers @{ Authorization = "Bearer $token" }

⚠️ 7. Resolução de Erros Comuns (Troubleshooting)
❌ Erro 401 Unauthorized no Login
Causa: O utilizador inicial não foi criado na base de dados.

Solução: Execute npx ts-node src/criar-usuario.ts.

❌ Erro 500 Internal Server Error / PrismaClientValidationError
Causa: Envio de campos no corpo do pedido que não existem na tabela do Prisma (ex: descricao em vez de precoVendaVarejo), ou base de dados desatualizada.

Solução: Verifique se o JSON utiliza os campos reais do schema e execute npx prisma db push.

❌ Erro P1012: The model "Produto" cannot be defined because a model with that name already exists
Causa: Declaração duplicada do modelo Produto no ficheiro prisma/schema.prisma.

Solução: Remova a duplicata no schema.prisma e execute npx prisma db push.

📂 8. Estrutura do Projeto
Plaintext
backend/
├── prisma/
│   └── schema.prisma          # Modelos de dados (Usuario, Funcionario, Produto)
├── src/
│   ├── auth/                  # Módulo de Autenticação JWT e Estratégias Passport
│   │   ├── dto/
│   │   │   └── login.dto.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── jwt.strategy.ts
│   ├── produtos/              # Módulo CRUD de Produtos
│   │   ├── dto/
│   │   │   ├── create-produto.dto.ts
│   │   │   └── update-produto.dto.ts
│   │   ├── produtos.controller.ts
│   │   ├── produtos.module.ts
│   │   └── produtos.service.ts
│   ├── prisma/                # Serviço global de ligação ao Prisma Client
│   ├── criar-usuario.ts       # Script para registar o administrador inicial
│   └── main.ts                # Ficheiro principal da aplicação
├── .env.example               # Modelo das variáveis de ambiente
├── package.json               # Dependências do projeto
└── README.md                  # Documentação completa

📤 9. Versionamento e Envio para o GitHub
Para salvar todas as alterações e enviar o histórico atualizado para o repositório remoto:

PowerShell
# 1. Adicionar ficheiros alterados e criados
git add .

# 2. Registar o commit
git commit -m "docs: adiciona documentacao completa do projeto do zero ao modulo de produtos"

# 3. Enviar para o GitHub
git push