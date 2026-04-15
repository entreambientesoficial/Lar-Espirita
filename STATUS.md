# STATUS DO PROJETO — Portal do Voluntário
## Lar Beneficente Eurípedes Barsanulfo

> **Atualizado em:** 2026-04-15  
> **Status Geral:** ✅ FUNCIONAL — Servidor local rodando em `http://localhost:5173/`  
> **Repositório Git:** `https://github.com/entreambientesoficial/Lar-Espirita` (branch `main`)

---

## 1. VISÃO GERAL DO PROJETO

Portal web interno para gestão de voluntários (médiuns) do Lar Beneficente Eurípedes Barsanulfo. O sistema é controlado pelo administrador, que cadastra previamente os médiuns. O acesso dos voluntários é feito via link de convite enviado por WhatsApp ou e-mail.

**Stack Tecnológica:**
- **Frontend:** React + Vite + Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL + Auth + Realtime)
- **Autenticação:** Google OAuth + E-mail/Senha
- **Fontes:** Plus Jakarta Sans (headline) + Manrope (body) via Google Fonts
- **Ícones:** Material Symbols Outlined

---

## 2. ESTRUTURA DE ARQUIVOS

```
APP-CENTROESPIRITA/
├── .env                          ← Variáveis secretas (NÃO subir para git)
│   ├── VITE_SUPABASE_URL
│   └── VITE_SUPABASE_ANON_KEY
├── .gitignore                    ← Inclui .env e node_modules
├── index.html                    ← Carrega fontes Google + Material Symbols
├── package.json
├── vite.config.js
├── setup_atividades.sql          ← Script de referência do banco de dados
├── img-apoio/                    ← Imagens originais de referência
│   ├── logo.jpg                  ← Logo da instituição
│   ├── tela-login.png            ← Fundo da tela de login
│   └── caridade.png
├── public/
│   └── img-apoio/               ← Imagens servidas pelo Vite (usar estas nas rotas)
│       ├── logo.jpg
│       ├── tela-login.png
│       └── caridade.png
└── src/
    ├── main.jsx                  ← Ponto de entrada (AuthProvider + BrowserRouter)
    ├── App.jsx                   ← Roteamento principal
    ├── index.css                 ← Design System / Tokens de cores e fontes
    ├── context/
    │   └── AuthContext.jsx       ← Lógica central de autenticação
    ├── lib/
    │   └── supabase.js           ← Cliente Supabase + dataService
    ├── components/
    │   ├── Layout.jsx            ← Header + BottomNavBar + lógica de roles
    │   └── ProtectedRoute.jsx    ← Guard para rotas de admin
    └── pages/
        ├── BemVindo.jsx          ← Tela de Login ← ARQUIVO MAIS EDITADO
        ├── Dashboard.jsx         ← Tela inicial do voluntário
        ├── Agenda.jsx            ← Agenda semanal de atividades
        ├── Checkin.jsx           ← Scanner QR Code para presença
        └── Admin.jsx             ← Painel de gestão (apenas admins)
```

---

## 3. DESIGN SYSTEM (index.css)

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#0D47A1` | Azul Marinho — cor principal |
| `--color-background` | `#F5F5F7` | Fundo geral (branco gelo) |
| `--color-surface` | `#ffffff` | Superfícies de cards |
| `--color-on-surface` | `#1a1c1d` | Texto principal |
| `--color-primary-container` | `#E3F2FD` | Azul claro suave |
| `--font-headline` | `Plus Jakarta Sans` | Títulos e cabeçalhos |
| `--font-body` | `Manrope` | Textos corridos |

---

## 4. BANCO DE DADOS SUPABASE

### Tabelas Principais

#### `public.profiles`
Criada automaticamente por trigger no primeiro login. Campos:
- `id` (UUID — mesmo ID do `auth.users`)
- `name` (TEXT)
- `email` (TEXT)
- `role` (TEXT) — valores: `'admin'` ou `'volunteer'`
- `created_at`

#### `public.pre_cadastros`
Tabela de controle de autorização prévia. Admin insere antes do voluntário criar conta.
- `id` (UUID)
- `name` (TEXT) — nome do médium
- `email` (TEXT) — e-mail que será usado no cadastro
- `role` (TEXT) — padrão `'volunteer'`
- `created_at`

#### `public.atividades`
Agenda de trabalhos da casa.
- `id` (UUID)
- `nome` (TEXT)
- `horario` (TEXT)
- `descricao` (TEXT)
- `dia_semana_index` (INTEGER) — 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
- `icone` (TEXT) — nome do ícone Material Symbols

**Dados inseridos:**
- Qui: Cura Dr. Bezerra (09:00-12:00), Evangelização Infantil (19:00-20:30)
- Sex: Desobsessão (19:00)
- Sáb: Grupo de Estudos (15:00-17:00)

#### `public.presencas`
Registros de check-in dos voluntários.
- `id` (UUID)
- `user_id` (UUID → profiles.id)
- `atividade_id` (UUID → atividades.id)
- `checkin_time` (TIMESTAMP) — padrão `now()`

### Trigger Crítico
```sql
-- handle_new_user: executa em auth.users AFTER INSERT
-- Consulta pre_cadastros pelo e-mail do novo usuário
-- Cria automaticamente o perfil em public.profiles com o role correto
```
> ⚠️ **IMPORTANTE:** Este trigger é a peça central de segurança. Sem ele, novos usuários não terão perfil e o sistema não funcionará.

---

## 5. FLUXO DE AUTENTICAÇÃO

```
ADMIN cadastra médium (Nome + E-mail) na tela /admin
       ↓
Sistema insere em pre_cadastros
       ↓
Admin copia mensagem de convite (gerada automaticamente) e envia por WhatsApp
       ↓
Médium recebe link: https://[domínio]/
       ↓
Médium escolhe:
  A) "Entrar com Google" → OAuth → trigger cria perfil → /dashboard
  B) "Primeiro acesso? Crie sua senha..." → form de cadastro com e-mail+senha
     → signUp → link de confirmação no e-mail → /dashboard
       ↓
Nos logins seguintes: usa a opção que escolheu (Google ou e-mail+senha)
       ↓
Recuperação de senha: "Esqueci minha senha" → e-mail com link de reset
```

---

## 6. ROTAS DA APLICAÇÃO

| Rota | Componente | Proteção | Descrição |
|---|---|---|---|
| `/` | `BemVindo.jsx` | Pública | Tela de login |
| `/dashboard` | `Dashboard.jsx` | Autenticado | Tela inicial do voluntário |
| `/agenda` | `Agenda.jsx` | Autenticado | Agenda semanal |
| `/checkin` | `Checkin.jsx` | Autenticado | Scanner QR Code |
| `/admin` | `Admin.jsx` | `role === 'admin'` | Painel de gestão |

---

## 7. FUNCIONALIDADES POR PÁGINA

### `/` — BemVindo.jsx (Tela de Login)
- Fundo: imagem `/img-apoio/tela-login.png` (posição `50% 10%` para enquadrar os rostos)
- Overlay branco `bg-white/40` + blur sutil para legibilidade
- Logo circular da instituição
- Botão "Entrar com Google"
- Separador "ou e-mail"
- Formulário de login (e-mail + senha)
- Link inferior: **"Primeiro acesso? Crie sua senha aqui ou acesse com sua conta Google"** → alterna para formulário de cadastro
- Link "Esqueci minha senha" → alterna para formulário de recuperação
- ⚠️ **NÃO HÁ** "Cadastre-se" aberto — o cadastro só funciona se o e-mail estiver em `pre_cadastros`

### `/admin` — Admin.jsx (Painel de Gestão)
- Aba **Presenças Hoje:** tabela em tempo real via Supabase Realtime
- Aba **Médiuns & Gestores:**
  - Formulário para cadastrar novo médium (Nome + E-mail → insere em `pre_cadastros`)
  - Gera mensagem de convite formatada para copiar e enviar via WhatsApp
  - Tabela de todos os usuários com opção de promover/revogar Admin

### `/dashboard` — Dashboard.jsx
- Boas-vindas personalizadas com nome do voluntário
- Card com atividade do dia atual
- Resumo de presenças

### `/agenda` — Agenda.jsx
- Lista de todas as atividades por dia da semana
- Dados vêm de `public.atividades`

### `/checkin` — Checkin.jsx
- Scanner de QR Code via câmera
- Registra presença em `public.presencas`

---

## 8. CONTEXTO DE AUTENTICAÇÃO (AuthContext.jsx)

Fornece para toda a aplicação via `useAuth()`:

| Propriedade/Função | Tipo | Descrição |
|---|---|---|
| `session` | objeto | Sessão atual do Supabase Auth |
| `profile` | objeto | Dados do usuário de `public.profiles` |
| `loading` | boolean | Estado de carregamento inicial |
| `signInWithGoogle()` | função | Login OAuth Google |
| `signUpWithEmail(email, pw)` | função | Cadastro com e-mail e senha |
| `signInWithEmail(email, pw)` | função | Login com e-mail e senha |
| `sendPasswordReset(email)` | função | Envia e-mail de recuperação |
| `signOut()` | função | Encerra sessão |

---

## 9. NAVEGAÇÃO (Layout.jsx)

- **Header:** logo + nome "Casa Espírita" + botão logout
- **BottomNavBar:** Início / Agenda / Check-in / Gestão
- A aba "Gestão" só aparece desbloqueada para `profile.role === 'admin'`; caso contrário mostra ícone de cadeado e bloqueia o acesso com toast de aviso
- A tela de login (`/`) não renderiza o header nem a nav — sem `<Layout>`

---

## 10. PARA FAZER O DEPLOY EM PRODUÇÃO

> O código está no GitHub mas **ainda não foi hospedado** em produção.

**Passos para deploy na Vercel:**
1. Acesse vercel.com e conecte o repositório `entreambientesoficial/Lar-Espirita`
2. Configure as **Environment Variables** no painel da Vercel:
   ```
   VITE_SUPABASE_URL=<sua url do supabase>
   VITE_SUPABASE_ANON_KEY=<sua chave anon>
   ```
3. No Supabase, adicione a URL de produção (ex: `https://lar-espirita.vercel.app`) em:
   - Authentication → URL Configuration → Site URL
   - Authentication → URL Configuration → Redirect URLs
4. No Google Cloud Console, adicione a URL de produção como URI de redirecionamento OAuth autorizado

---

## 11. COMO RODAR LOCALMENTE

```powershell
# Entrar na pasta do projeto
cd c:\APP-SITE-SAAS\APP-CENTROESPIRITA

# Instalar dependências (primeira vez)
npm install

# Rodar o servidor de desenvolvimento
npm run dev

# Acessa em: http://localhost:5173/
```

> ⚠️ **Atenção:** Se o servidor travar (tela preta/connection refused), rode no PowerShell:
> ```powershell
> taskkill /F /IM node.exe; Start-Sleep -Seconds 2; npm run dev
> ```

---

## 12. PENDÊNCIAS / PRÓXIMOS PASSOS

- [ ] Deploy em produção (Vercel ou Netlify)
- [ ] Teste de ponta a ponta em produção (cadastrar médium → receber convite → fazer primeiro acesso)
- [ ] Configurar domínio personalizado (se desejado)
- [ ] Exportação de relatório de presenças em PDF (futuro)
- [ ] Notificações push para lembretes de atividades (futuro)
