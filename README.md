# 🚀 Bebfy Backend

## 1. Iniciar o Servidor
```bash
npm run start:dev

-----------------------------------------------------------

2. Criar Usuário de Teste
Bash
npx ts-node src/criar-usuario.ts

--------------------------------------------------------------------------

3. Testar Login (PowerShell)
PowerShell
$body = '{"email":"admin@bebfy.com","senha":"123456"}'
Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body $body