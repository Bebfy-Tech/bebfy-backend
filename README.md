Aqui está o **ficheiro `README.md` completo, definitivo e perfeitamente formatado**.

Eu juntei **toda a estrutura do projeto** com as **explicações super detalhadas de cada comando bash** que pediu. O resultado é uma documentação de altíssimo nível, digna de um projeto profissional.

Basta copiar o bloco inteiro abaixo e colar no seu ficheiro `README.md`:

---

```markdown
# 🚀 Bebfy Backend — Documentação Oficial do Projeto

API Backend para a plataforma **Bebfy**, desenvolvida com **NestJS**, **Prisma ORM**, **PostgreSQL**, **JWT** e **Bcrypt**.

Este documento contém o manual de configuração do projeto, os endpoints da API e o **histórico técnico exato** de todos os comandos executados para construí-lo do zero até o estado atual.

---

## 🛠️ 1. Requisitos e Instalação

### Requisitos Prévios
* **Node.js** (v18 ou superior)
* **PostgreSQL** ativo na porta `5432` com a base de dados `bebfy` criada.
* **Git** instalado.

### 📦 Instalação das Bibliotecas Base (Histórico de Construção)
Se clonar o projeto agora, basta rodar `npm install`. Mas, para fins de documentação técnica, este é o detalhamento de todos os pacotes instalados e o que cada comando `bash` fez no sistema:

**1. Base de Dados e ORM:**
```bash
# @prisma/client: Biblioteca injetada no código NestJS para interagir com o PostgreSQL.
npm install @prisma/client

# prisma: Ferramenta de linha de comando (CLI) instalada como dependência de desenvolvimento (-D) para executar migrações e sincronização.
npm install -D prisma

```

**2. Segurança e Autenticação:**

```bash
# @nestjs/jwt e passport-jwt: Geram e validam os Tokens JWT nas rotas.
# @nestjs/passport e passport: Integram o sistema de estratégias de autenticação ao NestJS.
# bcrypt: Encripta as senhas dos utilizadores antes de as guardar no banco.
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt

# Instala as tipagens do TypeScript para o Bcrypt e Passport funcionarem sem erros de compilação.
npm install -D @types/bcrypt @types/passport-jwt

```

**3. Validações, DTOs e Execução de Scripts:**

```bash
# @nestjs/mapped-types: Permite criar o 'UpdateProdutoDto' reaproveitando os campos do 'CreateProdutoDto', tornando-os todos opcionais automaticamente.
# class-validator e class-transformer: Usados para validar os dados de entrada (ex: garantir que o preço é um número).
npm install @nestjs/mapped-types class-validator class-transformer

# ts-node: Executável que permite rodar ficheiros TypeScript (.ts) avulsos no terminal sem precisar compilar para JavaScript primeiro.
npm install -D ts-node

```

---

## ⚙️ 2. Configuração do Ambiente e Banco de Dados

### Ficheiro `.env`

Crie um ficheiro **`.env`** na raiz do projeto com as suas credenciais locais:

```env
# URL de Ligação ao PostgreSQL local (ajuste utilizador e senha da sua máquina)
DATABASE_URL="postgresql://postgres:SUA_SENHA_AQUI@localhost:5432/bebfy?schema=public"

# Chave secreta para assinatura dos tokens JWT
JWT_SECRET="segredo_super_secreto_bebfy"

# Porta onde o servidor vai rodar
PORT=3000

```

### Sincronização do Prisma (PostgreSQL)

Com o ficheiro `prisma/schema.prisma` configurado (tabelas de Usuario, Funcionario e Produto), execute:

```powershell
# Este comando lê o arquivo schema.prisma, conecta-se ao PostgreSQL usando a URL do '.env', cria as tabelas fisicamente no banco e gera os tipos do Prisma Client para o TypeScript.
npx prisma db push

```

---

## 🏗️ 3. Histórico de Criação dos Módulos

Os módulos atuais foram construídos utilizando a CLI do NestJS. Abaixo está o registo exato dos comandos utilizados:

### Geração do Módulo de Autenticação (`AuthModule`)

Como a autenticação não é um CRUD padrão, os ficheiros foram gerados individualmente:

```bash
# Cria o ficheiro 'auth.module.ts' para agrupar as dependências de autenticação.
npx nest g module auth

# Cria o ficheiro 'auth.service.ts' onde fica a regra de negócio (validar o e-mail no banco e comparar a senha com bcrypt).
npx nest g service auth

# Cria o ficheiro 'auth.controller.ts' que expõe as rotas de rede (ex: POST /auth/login e GET /auth/perfil).
npx nest g controller auth

```

### Geração do Módulo de Produtos (`ProdutosModule`)

Para este módulo, utilizámos o gerador de recursos (Resource Generator), que cria a estrutura completa do CRUD de uma só vez:

```bash
# Constrói automaticamente o Module, Service, Controller, a pasta de DTOs e a pasta Entities.
npx nest g resource produtos

```

**Interações no terminal durante este comando:**

1. *What transport layer do you use?* -> **`REST API`** *(Define que a comunicação será via rotas HTTP: GET, POST, PUT, DELETE).*
2. *Would you like to generate CRUD entry points?* -> **`Y`** (Yes) *(Define que o NestJS já deve escrever os métodos iniciais de Criar, Listar, Atualizar e Eliminar).*

---

## 👤 4. Criação do Administrador (Bootstrap)

Para conseguir fazer login, precisa de injetar o utilizador inicial com a senha encriptada. Execute:

```powershell
# Utiliza a biblioteca 'ts-node' para rodar o script diretamente no banco de dados, sem levantar o servidor web.
npx ts-node src/criar-usuario.ts

```

* **E-mail gerado:** `admin@bebfy.com`
* **Senha gerada:** `123456`

---

## 🔑 5. Endpoints da API

### 🛡️ Autenticação (`/auth`)

* `POST /auth/login` — Efetua o login e retorna o `access_token` JWT.
* `GET /auth/perfil` — *(Protegido)* Retorna as informações do utilizador logado.

### 📦 Produtos (`/produtos`) - Protegido por JWT

* `POST /produtos` — Regista um novo produto.
* `GET /produtos` — Lista todos os produtos (do mais recente para o mais antigo).
* `GET /produtos/:id` — Busca um produto pelo ID.
* `PATCH /produtos/:id` — Atualiza os dados de um produto.
* `DELETE /produtos/:id` — Elimina um produto.

**Exemplo de JSON para criar Produto (`CreateProdutoDto`):**

```json
{
  "nome": "Cerveja Heineken 600ml",
  "precoVendaVarejo": 12.50,
  "estoqueAtual": 48,
  "retornavel": true,
  "unidadeMedida": "UN"
}

```

---

## 🧪 6. Script de Testes Rápidos (PowerShell)

Inicie o servidor em modo de desenvolvimento (o sistema monitoriza os ficheiros e reinicia automaticamente ao salvar):

```powershell
npm run start:dev

```

Numa **nova janela do PowerShell**, execute este bloco para testar o fluxo completo:

```powershell
# 1. Faz Login e guarda o Token JWT
$resposta = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@bebfy.com","senha":"123456"}'
$token = $resposta.access_token

# 2. Testa rota protegida do Perfil
Invoke-RestMethod -Uri "http://localhost:3000/auth/perfil" -Method Get -Headers @{ Authorization = "Bearer $token" }

# 3. Cria um novo Produto
$novoProduto = '{"nome":"Cerveja Heineken 600ml","precoVendaVarejo":12.50,"estoqueAtual":48,"retornavel":true,"unidadeMedida":"UN"}'
Invoke-RestMethod -Uri "http://localhost:3000/produtos" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $novoProduto

# 4. Lista todos os Produtos
Invoke-RestMethod -Uri "http://localhost:3000/produtos" -Method Get -Headers @{ Authorization = "Bearer $token" }

```

---

## ⚠️ 7. Troubleshooting (Erros já mapeados)

* **`401 Unauthorized` no Login:** O utilizador admin inicial não existe. Resolvido rodando `npx ts-node src/criar-usuario.ts`.
* **`500 Internal Server Error` (PrismaClientValidationError):** Os campos enviados no JSON (DTO) divergem da estrutura real do banco. Corrija o DTO e rode `npx prisma db push`.
* **`P1012: The model "Produto" cannot be defined...`:** Duplicação no arquivo `schema.prisma`. Apague a tabela repetida e sincronize novamente.

---

## 📂 8. Estrutura Atual do Código (`src/`)

```text
src/
├── auth/                  # Módulo de Autenticação JWT (Login e Validação)
├── prisma/                # Módulo Global de conexão ao PostgreSQL
├── produtos/              # Módulo CRUD de Produtos integrado ao banco
├── criar-usuario.ts       # Script de inicialização (Admin Bootstrap)
├── app.module.ts          # Arquivo central que regista todos os módulos
└── main.ts                # Inicialização da API na porta 3000

```

```

***

Pronto! Com este `README.md` esteticamente impecável e extremamente rico em detalhes técnicos, o seu repositório está num nível de maturidade muito alto.

Para finalizar esta etapa épica com chave de ouro e guardar no GitHub, execute no terminal:

```powershell
git add README.md
git commit -m "docs: reformula README com estrutura definitiva, bash detalhados, historico e layout profissional"
git push

```