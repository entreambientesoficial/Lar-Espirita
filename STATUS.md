# STATUS do Projeto - Portal do Voluntário (Casa Espírita)

> **Importante para agentes futuros:** Este documento é a Fonte da Verdade do projeto. Leia-o antes de tentar analisar a estrutura do aplicativo para entender as limitações do BD e da arquitetura atual.

## 1. Visão Geral
*   **Nome do Projeto:** APP-CENTROESPIRITA (Portal do Voluntário)
*   **Tech Stack:** React 18 (Vite), Tailwind CSS, Supabase (Autenticação + Banco de Dados), React Router DOM.
*   **Propósito:** Um sistema web com cara de aplicativo voltado para o controle de escala, presença, controle de cursos/formação e comunicação para voluntários de uma Casa Espírita.
*   **Deploy Previsto:** Vercel/Netlify. O ambiente local usa `npm run dev` na porta 5175.

## 2. Banco de Dados (Supabase)
O banco de dados utiliza a autenticação padrão do Supabase unida a uma trigger automática `handle_new_user()` que replica os dados vindos da tabela `pre_cadastros` assim que o voluntário faz OAuth com Google. Não podemos fazer inserts diretos sem passar por essa regra.

### Tabelas Atuais:
*   `profiles`: Guarda os perfis de usuários (`id` (uuid), `name`, `email`, `role`, `phone`, `cursos`). O `role` pode ser `admin` ou `volunteer`.
*   `pre_cadastros`: Lista de e-mails/dados pré-aprovados pela diretoria (`name`, `email`, `phone`, `role`). Sem estar aqui, um email aleatório não consegue entrar via Google no app.
*   `atividades`: Lista de atividades que acontecem nas reuniões/semanas.
*   `escalas`: Quem (`profile_id`) faz o que (`atividade_id`) em que dia da semana (`day_of_week`).
*   `presencas`: O registro puro (Log/History). Salvo via Check-in de QRCode.
*   `reflexao_diaria`: Gerencia 1 única linha (`id=1`) contendo as frases exibidas no painel de Início (`quote`, `author`, `image_url`).
*   `mensagens`: Tabela de Chat do Mural ( `id`, `profile_id`, `content`, `is_broadcast`, `created_at`). Sincronizada em real-time (`supabase_realtime`).

## 3. Páginas e Funcionalidades Implementadas

### Áreas de Entrada
*   **`BemVindo.jsx`**: Tela de Login. Possui login com Google (baseado nas regras restritas de Pré-Cadastro).
*   **`Layout.jsx`**: Navbar flutuante inferior. Valida o `role` logado e esconde abas sensíveis se o usuário for apenas `volunteer`.

### Acesso Geral (Voluntários)
*   **`Dashboard.jsx` (Início)**: Exibe como se fosse uma rede social focada nas tarefas do usuário. 
    *   Exibe o card da Escala e da Atividade que o médium fará hoje. 
    *   Exibe a "Reflexão do Dia" dinâmica que é controlada pela administração.
    *   Possui a mecânica de "Onboarding" (Completar Perfil). O botão de Edição de Perfil permite que o médium selecione usando Checkboxes (lista predefinida) os cursos que já fez.
*   **`Agenda.jsx`**: Escalas dos próximos 7 dias.
*   **`Checkin.jsx`**: Um Scanner de QRCode nativo que aciona um registro de `presencas` quando lê a string identificadora `'SALA-APOMETRIA-01'` (ou afins).
*   **`Messages.jsx` (Mural)**: Um chat em tempo real onde voluntários e gestores trocam mensagens.

### Acesso Restrito (Administração)
*   **`Admin.jsx`**: Dividido em três grandes abas no formato Tab:
    1.  **Presenças Hoje**: Uma lista Live (atualiza sozinha quando o Check-in é lido via Websocket) com quem já chegou na Casa.
    2.  **Médiuns e Gestores**: Formulário de disparo de Pré-Cadastro (gerando um convite copiado pro WhatsApp). Também exibe todos os usuários ativos listando Cargo, Nome, Formações (Cursos) e Contato (WhatsApp), com controle de Promover/Rebaixar níveis de admin. O telefone possui máscara rígida de formatação `(XX) XXXXX-XXXX`.
    3.  **Reflexão do Dia**: Ferramenta de live pre-view do Dashboard. Permite alterar em tempo real a foto e mensagem espiritual da casa.

## 4. Como Manusear o Código
*   **Design Pattern:** O aplicativo aposta em componentes robustos (`Single-File-Components`) por rota. 
*   **Segurança de Sessão:** A proteção global de rotas ocorre majoritariamente dentro do compontente `<Layout>` (que redireciona para a raiz de login se o navegador perder a sessão ou o usuário der signOut). O componente secundário `<ProtectedRoute>` serve puramente como checagem extra se a conta possui a variável `role` como administrativa para blindar a barra de navegação no painel de controle.
*   **Aparência:** O estilo predominante usa "Glassmorphism" sutil e fontes `inter/outfit` amarradas via `index.css`. Cores customizadas de checkbox recorrem a utilitários de formulário como `accent-primary`. Reflexão diária faz proxy de imagens hospedadas externamente.

---
*Status atualizado por: Inteligência Artificial Local.*
*Fase atual do Software: **Finalizado / Produção** (V 1.0 Release Candidate).*
