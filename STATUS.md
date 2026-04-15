# STATUS do Projeto - Portal do Voluntário (Casa Espírita)

> **Importante para agentes futuros:** Este documento é a Fonte da Verdade do projeto. Leia-o antes de tentar analisar a estrutura do aplicativo para entender as limitações do BD e da arquitetura atual.

## 1. Visão Geral
*   **Nome do Projeto:** APP-CENTROESPIRITA (Portal do Voluntário)
*   **Casa:** Lar Beneficente Eurípedes Barsanulfo
*   **Tech Stack:** React 18 (Vite), Tailwind CSS, Supabase (Autenticação + Banco de Dados), React Router DOM.
*   **Propósito:** Um sistema web com cara de aplicativo voltado para o controle de escala, presença, controle de cursos/formação e comunicação para voluntários de uma Casa Espírita.
*   **Deploy:** Cloudflare Pages. O ambiente local usa `npm run dev` na porta 5175.
*   **Build:** `npm run build` → pasta `dist/`. Code splitting configurado (vendor-react, vendor-supabase, vendor-qrcode).

## 2. Banco de Dados (Supabase)
O banco de dados utiliza a autenticação padrão do Supabase unida a uma trigger automática `handle_new_user()` que replica os dados vindos da tabela `pre_cadastros` assim que o voluntário faz OAuth com Google. Não podemos fazer inserts diretos sem passar por essa regra.

**RLS (Row Level Security) está ATIVO** em todas as tabelas desde a v1.1.

### Tabelas Atuais:
*   `profiles`: Guarda os perfis de usuários (`id` (uuid), `name`, `email`, `role`, `phone`, `cursos`). O `role` pode ser `admin` ou `volunteer`.
*   `pre_cadastros`: Lista de e-mails/dados pré-aprovados pela diretoria (`name`, `email`, `phone`, `role`). Sem estar aqui, um e-mail aleatório não consegue entrar via Google no app.
*   `atividades`: Agenda geral da casa. Colunas: `id`, `name`, `time_range`, `description`, `day_of_week` (1=Seg … 6=Sáb), `icon` (Material Symbol), `created_at`. Populada via `setup_atividades.sql`.
*   `presencas`: Registro de presença (Log/History). Salvo via Check-in de QRCode. Colunas: `id`, `user_id` (FK → profiles), `atividade_id` (FK → atividades), `checkin_time`.
*   `reflexao_diaria`: Gerencia 1 única linha (`id=1`) com as frases exibidas no painel de Início (`quote`, `author`, `image_url`).
*   `mensagens`: Chat do Mural (`id`, `profile_id`, `content`, `is_broadcast`, `created_at`). Sincronizada em real-time via `supabase_realtime`.

> **Nota:** A tabela `escalas` foi planejada mas **não foi criada no banco**. A agenda é gerida diretamente pela tabela `atividades` com o campo `day_of_week`, exibindo as atividades do dia para todos os voluntários sem distinção de escala individual.

### Script de dados:
*   `setup_atividades.sql` — popula a tabela `atividades` com a agenda completa da casa. Usar em caso de perda de dados. **Não usar TRUNCATE** (presencas tem FK para atividades); o script usa DELETE por `day_of_week`.

## 3. Páginas e Funcionalidades Implementadas

### Áreas de Entrada
*   **`BemVindo.jsx`**: Tela de Login. Possui login com Google (baseado nas regras restritas de Pré-Cadastro).
*   **`Layout.jsx`**: Navbar flutuante inferior. Valida o `role` logado e esconde abas sensíveis se o usuário for apenas `volunteer`.

### Acesso Geral (Voluntários)
*   **`Dashboard.jsx` (Início)**: Exibe as tarefas do voluntário no dia.
    *   Exibe o card da Atividade de hoje (busca em `atividades` pelo `day_of_week` atual).
    *   Exibe a "Reflexão do Dia" dinâmica controlada pela administração.
    *   Possui a mecânica de "Onboarding" (Completar Perfil). O botão de Edição de Perfil permite selecionar via Checkboxes os cursos realizados.
*   **`Agenda.jsx`**: Agenda semanal completa da casa. Exibe todas as atividades de cada dia (Seg–Sáb) com seletor de dia horizontal.
*   **`Checkin.jsx`**: Scanner de QRCode nativo que registra presença na tabela `presencas`. Exige que haja atividade programada para o dia; sem atividade, exibe mensagem de erro em vez de simular sucesso.
*   **`Messages.jsx` (Mural)**: Chat em tempo real. Admins podem enviar "Comunicados Oficiais" (broadcast).

### Acesso Restrito (Administração)
*   **`Admin.jsx`**: Dividido em três abas:
    1.  **Presenças Hoje**: Lista live (atualiza via Websocket quando Check-in é lido).
    2.  **Médiuns e Gestores**: Formulário de Pré-Cadastro com validação de e-mail, telefone e duplicata. Gera convite para WhatsApp. Lista todos os usuários com controle de Promover/Rebaixar (protegido: não permite remover o último admin nem auto-rebaixamento).
    3.  **Reflexão do Dia**: Live preview do Dashboard. Altera foto e mensagem espiritual em tempo real.

## 4. Como Manusear o Código
*   **Design Pattern:** Componentes robustos `Single-File-Components` por rota.
*   **Segurança de Sessão:** Proteção global de rotas no `<Layout>` (redireciona para login se sessão expirar). `<ProtectedRoute>` faz checagem extra de `role === 'admin'` para o painel de controle. RLS no Supabase é a camada de segurança server-side.
*   **Segurança de Dados:** RLS ativo. Voluntários só leem/editam seus próprios dados. Admins têm acesso expandido via políticas específicas.
*   **ErrorBoundary:** Implementado na raiz (`main.jsx`). Qualquer crash exibe tela amigável com botão de recarregar.
*   **Aparência:** Glassmorphism sutil, fontes `Plus Jakarta Sans` / `Manrope` via Google Fonts, ícones via Material Symbols Outlined.

## 5. Configuração de Deploy (Cloudflare Pages)

| Configuração | Valor |
|---|---|
| Build command | `npm run build` |
| Build output | `dist` |
| Node.js version | 18 (`.nvmrc`) |
| Env var 1 | `VITE_SUPABASE_URL` |
| Env var 2 | `VITE_SUPABASE_ANON_KEY` |

**Após o deploy**, configurar no Supabase → Authentication → URL Configuration:
*   **Site URL:** URL do Cloudflare Pages
*   **Redirect URLs:** `<URL>/dashboard`

---
*Status atualizado por: Inteligência Artificial Local.*
*Fase atual do Software: **Pronto para Deploy** (V 1.1 — Auditoria de Segurança Aplicada).*
