# STATUS do Projeto - Portal do Voluntário (Casa Espírita)

> **Importante para agentes futuros:** Este documento é a Fonte da Verdade do projeto. Leia-o antes de tentar analisar a estrutura do aplicativo para entender as limitações do BD e da arquitetura atual.

## 1. Visão Geral
*   **Nome do Projeto:** APP-CENTROESPIRITA (Portal do Voluntário)
*   **Casa:** Lar Beneficente Eurípedes Barsanulfo
*   **Tech Stack:** React 18 (Vite), Tailwind CSS v4, Supabase (Autenticação + Banco de Dados), React Router DOM v7, qrcode.react.
*   **Propósito:** Sistema web (PWA-like) para controle de escala, presença, formação e comunicação de voluntários de uma Casa Espírita.
*   **Deploy:** Cloudflare Pages — URL: `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Ambiente local:** `npm run dev` na porta 5175. Node.js >= 20 obrigatório.
*   **Build:** `npm run build` → pasta `dist/`. Code splitting: vendor-react, vendor-supabase, vendor-qrcode (html5-qrcode + qrcode.react).

## 2. Banco de Dados (Supabase)

O banco utiliza autenticação padrão do Supabase com trigger automática `handle_new_user()` que replica dados de `pre_cadastros` ao fazer OAuth com Google. Não é possível criar perfis com INSERT direto sem passar por essa trigger.

**RLS (Row Level Security) está ATIVO** em todas as tabelas.

### Função auxiliar de RLS (OBRIGATÓRIA):
```sql
-- Evita recursão infinita nas políticas que verificam role de admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;
```
> Esta função **deve existir** no banco. Sem ela, as políticas de admin entram em recursão infinita e ninguém consegue carregar o próprio perfil.

### Trigger de novo usuário (OBRIGATÓRIA):
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, phone)
  SELECT
    new.id,
    COALESCE(pc.name, split_part(new.email, '@', 1)),
    new.email,
    COALESCE(pc.role, 'volunteer'),
    pc.phone
  FROM public.pre_cadastros pc
  WHERE lower(pc.email) = lower(new.email)
  LIMIT 1;
  RETURN new;
END;
$$;
```
> Usa `INSERT...SELECT` com `lower()` — se o e-mail não estiver em `pre_cadastros`, não insere nada (sem exceção). A política de INSERT em `profiles` deve ser `WITH CHECK (true)` para não bloquear esta trigger SECURITY DEFINER.

### Tabelas Atuais:

*   `profiles`: Perfis de usuários. Colunas: `id` (uuid), `name`, `email`, `role` (`admin` | `volunteer`), `phone`, `cursos`.
*   `pre_cadastros`: E-mails pré-aprovados pela diretoria. Sem estar aqui, nenhum e-mail externo consegue fazer login.
*   `atividades`: Agenda da casa. Colunas: `id`, `name`, `time_range`, `description`, `day_of_week` (1=Seg…6=Sáb), `icon` (Material Symbol), `created_at`. Populada via `setup_atividades.sql`.
*   `presencas`: Confirmações e presenças dos voluntários. Colunas: `id`, `user_id` (FK→profiles), `atividade_id` (FK→atividades), `checkin_time` (default `now()`), `qr_checkin` (boolean, default `false`).
*   `reflexao_diaria`: Uma única linha (`id=1`) com a frase do dia (`quote`, `author`, `image_url`).
*   `mensagens`: Mural/chat em tempo real. Colunas: `id`, `profile_id`, `content`, `is_broadcast`, `created_at`.

> **Nota:** A tabela `escalas` foi planejada mas **nunca foi criada**. Não referenciar essa tabela em código ou RLS.

### Políticas RLS aplicadas (estado atual):

**profiles:**
- SELECT: `auth.uid() = id OR is_admin()`
- UPDATE: `auth.uid() = id OR is_admin()`
- INSERT: `WITH CHECK (true)` — necessário para a trigger SECURITY DEFINER funcionar

**presencas:**
- SELECT: `user_id = auth.uid() OR is_admin()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid() AND qr_checkin = false`

### Scripts de dados:
*   `setup_atividades.sql` — popula `atividades` com a agenda completa. **Não usar TRUNCATE** (presencas tem FK para atividades).

### Token do QR Code:
O QR Code da Casa contém o valor fixo: **`LBEB-PRESENCA-2026`**
Definido em `src/lib/checkinToken.js`. Para alterar: edite o arquivo e reimprima pelo painel Admin.

## 3. Fluxo de Presença (IMPORTANTE)

O fluxo correto é em **dois passos**:

1. **Confirmação na Agenda** — voluntário acessa a aba Agenda, vê as atividades do dia e clica "Confirmar Presença" na que vai trabalhar. Isso cria um registro em `presencas` com `qr_checkin = false`. A atividade aparece no Dashboard com badge "Confirmado" e botão "Cancelar Presença" (vermelho).

2. **Check-in físico (QR Code)** — no local da Casa, o voluntário escaneia o QR Code impresso (disponível para impressão na aba Admin → QR Code da Casa). O app valida o token, atualiza `qr_checkin = true` no registro existente. O botão "Cancelar Presença" some (presença já efetivada).

> **Regras:** Cancelar presença só é possível ANTES do QR check-in. Após o scan, a presença é permanente.

## 4. Páginas e Funcionalidades

### Acesso Geral (Voluntários)
*   **`BemVindo.jsx`**: Tela de Login via Google OAuth (restrito a e-mails em `pre_cadastros`).
*   **`Layout.jsx`**: Navbar inferior flutuante. Esconde abas de Admin para `role = volunteer`.
*   **`Dashboard.jsx` (Início)**: Exibe a atividade confirmada do voluntário para hoje (vazio se não confirmou). Reflexão do Dia dinâmica. Botão "Cancelar Presença" em vermelho (some após QR check-in). Onboarding de perfil (cursos/telefone) no primeiro acesso.
*   **`Agenda.jsx`**: Agenda semanal (Seg–Sáb). Para o dia atual: botão "Confirmar Presença" funcional (insere em `presencas`) ou "Confirmado ✓ + Cancelar". Para outros dias: aviso "Confirmação disponível no dia".
*   **`Checkin.jsx`**: Scanner de QR Code. Valida o token `LBEB-PRESENCA-2026`. Se já confirmou pela Agenda, apenas marca `qr_checkin = true`. Se não confirmou, insere novo registro com `qr_checkin = true`. QR Code inválido exibe erro.
*   **`Messages.jsx` (Mural)**: Chat em tempo real via Supabase Realtime. Admins podem enviar "Comunicados Oficiais" (broadcast).

### Acesso Restrito (Administração)
*   **`Admin.jsx`**: Quatro abas:
    1. **Presenças Hoje**: Lista todos que confirmaram presença no dia (com ou sem QR check-in). Colunas: Médium, Atividade, Confirmou às, Check-in QR (Realizado/Pendente). Atualiza via Websocket em tempo real.
    2. **Médiuns e Gestores**: Formulário de Pré-Cadastro com validação. Gera convite WhatsApp. Controle de Promover/Rebaixar admin (protegido: não remove o último admin).
    3. **Reflexão do Dia**: Live preview. Altera frase e imagem espiritual em tempo real.
    4. **QR Code da Casa**: Exibe e permite imprimir o QR Code oficial para afixar na Casa.

## 5. Como Manusear o Código
*   **Design Pattern:** Single-File-Components por rota.
*   **Segurança de Sessão:** Proteção global no `<Layout>` (redireciona se sessão expirar). `<ProtectedRoute>` verifica `role === 'admin'`.
*   **RLS:** Camada server-side no Supabase. A função `is_admin()` (SECURITY DEFINER) é usada nas políticas para evitar recursão.
*   **Token QR:** Definido em `src/lib/checkinToken.js`. Compartilhado entre `Checkin.jsx` (validação) e `Admin.jsx` (geração do QR Code).
*   **ErrorBoundary:** Implementado em `main.jsx`. Crashes exibem tela amigável com botão de recarregar.
*   **Aparência:** Glassmorphism sutil, fontes `Plus Jakarta Sans` / `Manrope` via Google Fonts, ícones Material Symbols Outlined.

## 6. Configuração de Deploy (Cloudflare Pages)

| Configuração | Valor |
|---|---|
| Build command | `npm run build` |
| Build output | `dist` |
| Node.js version | **20** (`.nvmrc` e `NODE_VERSION=20` nas env vars) |
| Env var 1 | `VITE_SUPABASE_URL` |
| Env var 2 | `VITE_SUPABASE_ANON_KEY` |

**Supabase → Authentication → URL Configuration:**
*   **Site URL:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Redirect URLs:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev/dashboard` e `http://localhost:5175/dashboard`

> `package-lock.json` está no `.gitignore` — gerado localmente no Windows causa falha de build no Linux (Cloudflare). Nunca commitar o lock file.

---
*Status atualizado por: Inteligência Artificial (Claude Sonnet 4.6).*
*Fase atual: **V 1.3 — Login multi-usuário validado em produção**.*
