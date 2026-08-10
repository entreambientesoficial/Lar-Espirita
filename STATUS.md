# STATUS do Projeto - Portal do Voluntário (Casa Espírita)

> **Importante para agentes futuros:** Este documento é a Fonte da Verdade do projeto. Leia-o antes de tentar analisar a estrutura do aplicativo para entender as limitações do BD e da arquitetura atual.

## 1. Visão Geral
*   **Nome do Projeto:** APP-CENTROESPIRITA (Portal do Voluntário)
*   **Casa:** Apometria Elos de Amor e Paz
*   **Tech Stack:** React 18 (Vite), Tailwind CSS v4, Supabase (Autenticação + Banco de Dados), React Router DOM v7, qrcode.react.
*   **Propósito:** Sistema web (PWA instalável) para controle de escala, presença, formação e comunicação de voluntários da casa.
*   **Deploy:** Cloudflare Pages — URL: `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Ambiente local:** `npm run dev` na porta 5173 / 5175. Node.js >= 20 obrigatório.
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

*   `profiles`: Perfis de usuários. Colunas: `id` (uuid), `name`, `email`, `role` (`admin` | `volunteer`), `phone`, `cursos`, `active` (BOOLEAN DEFAULT true).
*   `pre_cadastros`: E-mails pré-aprovados pela diretoria. Sem estar aqui, nenhum e-mail externo consegue fazer login.
*   `atividades`: Agenda da casa. Colunas: `id`, `name`, `time_range`, `start_time`, `end_time`, `description`, `day_of_week` (0=Dom, 1=Seg…6=Sáb), `event_date` (DATE NULL para extras), `active` (BOOLEAN), `icon`, `created_at`.
*   `presencas`: Confirmações e presenças dos voluntários. Colunas: `id`, `user_id` (FK→profiles), `atividade_id` (FK→atividades), `checkin_time` (default `now()`), `qr_checkin` (boolean, default `false`).
*   `atendimento_pessoas`: Pessoas da Fila de Atendimento Público. Colunas: `id`, `nome`, `telefone`, `tipo_atendimento`, `prioridade` (`Normal` | `Urgente`), `motivo_urgencia`, `observacoes`, `data_entrada`, `dias_disponiveis` (JSONB), `periodos_disponiveis` (JSONB), `datas_indisponiveis` (JSONB), `observacoes_disponibilidade` (TEXT), `status` (`aguardando`, `programado`, `compareceu`, `atendido`, `nao_compareceu`, `cancelado`), `posicao_fila`, `created_at`, `updated_at`.
*   `atendimento_programacoes`: Agendamento de pessoas em sessões específicas. Colunas: `id`, `pessoa_id`, `atividade_id`, `event_date`, `start_time`, `end_time`, `ordem_sessao`, `prioridade`, `status`, `observacoes`, `created_at`, `updated_at`.
*   `atendimento_capacidades`: Vagas máximas configuradas por sessão/atividade. Colunas: `id`, `atividade_id`, `quantidade_salas`, `atendimentos_por_sala`, `capacidade`, `active`, `created_at`, `updated_at`.
*   `atendimento_historico`: Log imutável de auditoria. Colunas: `id`, `pessoa_id`, `programacao_id`, `admin_id`, `action`, `dados_anteriores`, `dados_novos`, `observacao`, `created_at`.

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

**atendimento_* (todas as 4 tabelas):**
- SELECT, INSERT, UPDATE, DELETE: `is_admin()` (restrito 100% a administradores; voluntários não têm acesso)

### Scripts de dados:
*   `migration_agenda.sql` — adiciona colunas `active`, `event_date`, `start_time`, `end_time`, índices, constraints e popula a nova grade regular de Apometria (Ter/Qua/Qui).
*   `migration_fila_atendimento.sql` — cria as tabelas `atendimento_pessoas`, `atendimento_programacoes`, `atendimento_capacidades` e `atendimento_historico` com RLS restrito a `is_admin()`.
*   `migration_disponibilidade_reagendamento.sql` — adiciona colunas JSONB de disponibilidade do atendido e cria as RPCs `atendimento_reagendar()` e `atendimento_cadastrar_e_programar_urgente()` com recarga de cache PostgREST.
*   `migration_profiles_active.sql` — adiciona a coluna `active` em `public.profiles` para controle de status operacional do médium.

---
*Status atualizado por: Inteligência Artificial (Antigravity).*
*Fase atual: **V 1.9.5 — Tela de Login refinada com Dark Glassmorphism, animação discreta em cascata, botões compactos lado a lado, alerta de e-mail não autorizado, PWA padronizado ("Apometria" / icon.png), fix na barra de navegação e adição do "Curso de Apometria" no perfil do voluntário**.*

## 3. Fluxo de Presença (IMPORTANTE)

O fluxo correto é em **dois passos**:

1. **Confirmação na Agenda** — voluntário acessa a aba Agenda, vê as atividades do dia e clica "Confirmar Presença" na que vai trabalhar. Isso cria um registro em `presencas` com `qr_checkin = false`. A atividade aparece no Dashboard com badge "Confirmado" e botão "Cancelar Presença" (vermelho).

2. **Check-in físico (QR Code)** — no local da Casa, o voluntário escaneia o QR Code impresso (disponível para impressão na aba Admin → QR Code da Casa). O app valida o token, atualiza `qr_checkin = true` no registro existente. O botão "Cancelar Presença" some (presença já efetivada).

> **Regras:** Cancelar presença só é possível ANTES do QR check-in. Após o scan, a presença é permanente.

## 4. Páginas e Funcionalidades

### Acesso Geral (Voluntários)
*   **`BemVindo.jsx`**: Tela de Login via Google OAuth + e-mail/senha (restrito a e-mails em `pre_cadastros`). Título "Apometria Elos de Amor e Paz". Logo circular institucional (`logo-elos.jpg`) com aura luminosa posicionada perfeitamente abaixo da flor de lótus superior. Fundo responsivo com a imagem espiritual `tela-login.jpg` sem sobreposição de cards sólidos. Dois botões compactos retangulares dispostos **lado a lado** na base: `[ G ] Google` e `[ ✉ ] E-mail`. Links de *"Primeiro acesso? Crie sua senha"* e *"Esqueci minha senha"* posicionados na base. Expansão dinâmica em painel *Dark Glassmorphism* translúcido (`bg-slate-950/80 backdrop-blur-xl`) ao clicar em e-mail, mantendo o fundo visível e fornecendo o botão *"← Voltar"*. Animação de entrada discreta em cascata (< 600ms total, com suporte a `prefers-reduced-motion: reduce`). Alerta de erro de autenticação em destaque na tela inicial (`🔒 E-mail não autorizado. Solicite acesso à administração da Casa.`). Layout com elevação de base (`pb-6 sm:pb-8`), garantindo exibição total no mobile sem necessidade de scroll.
*   **`Layout.jsx`**: Navbar inferior flutuante com regra `whitespace-nowrap` e ajuste fino de espaçamento nos itens para evitar quebra de linha em textos com hífen como *"Check-in"*. Esconde abas de Admin para `role = volunteer`.
*   **`Dashboard.jsx` (Início)**: Exibe a atividade confirmada do voluntário para hoje (vazio se não confirmou). Reflexão do Dia dinâmica. Botão "Cancelar Presença" em vermelho (some após QR check-in). Onboarding de perfil (incluindo o **"Curso de Apometria"** e telefone) no primeiro acesso. Banner de instalação PWA (Android/Chrome).
*   **`Agenda.jsx`**: Agenda semanal (Seg–Sáb). Para o dia atual: botão "Confirmar Presença" funcional (insere em `presencas`) ou "Confirmado ✓ + Cancelar". Para outros dias: aviso "Confirmação disponível no dia".
*   **`Checkin.jsx`**: Scanner de QR Code. Valida o token `LBEB-PRESENCA-2026`. Se já confirmou pela Agenda, apenas marca `qr_checkin = true`. Se não confirmou, insere novo registro com `qr_checkin = true`. QR Code inválido exibe erro.
*   **`Messages.jsx` (Mural)**: Chat em tempo real via Supabase Realtime. Admins podem enviar "Comunicados Oficiais" (broadcast).

### Acesso Restrito (Administração)
*   **`Admin.jsx`**: Quatro abas:
    1. **Presenças Hoje**: Lista todos que confirmaram presença no dia (com ou sem QR check-in). Colunas: Médium, Atividade, Confirmou às, Check-in QR (Realizado/Pendente). Atualiza via Websocket em tempo real.
    2. **Médiuns e Gestores**: Formulário "Cadastrar Novo Médium" com botão **"Cadastrar"** (gera convite WhatsApp). Controle de Promover/Rebaixar admin, filtro por status operacional (Ativo/Inativo), resumo de cadastrados no topo e tradução de níveis de acesso (`Médium`, `Gestor`, `Administrador`).
    3. **Reflexão do Dia**: Live preview. Altera frase e imagem espiritual em tempo real.
    4. **QR Code da Casa**: Exibe e permite imprimir o QR Code oficial da Casa com o título "Apometria Elos de Amor e Paz".

## 5. PWA (Progressive Web App)

O app é instalável como PWA em dispositivos móveis.

*   **`public/manifest.json`**: Manifesto configurado com o nome "Apometria Elos de Amor e Paz", nome curto `short_name: "Apometria"`, ícone oficial `/img-apoio/icon.png` (proveniente de `img-apoio/Icon.png`), `display: standalone`, `theme_color: #1a237e`.
*   **`public/sw.js`**: Service Worker — habilita instalação PWA.
*   **`index.html`**: Título "Portal do Voluntário - Apometria Elos de Amor e Paz", favicon e ícone Apple apontando para `/img-apoio/icon.png`, meta `apple-mobile-web-app-title` com o valor `"Apometria"`.
*   **`src/main.jsx`**: Registra o service worker apenas em produção (`import.meta.env.PROD`). Em modo dev (`localhost`), desregistra ativamente qualquer ServiceWorker antigo para evitar cache estático indesejado.
*   **Banner de instalação (Dashboard)**: Captura o evento `beforeinstallprompt` e exibe banner com botão "Instalar" ao usuário. Funciona em Android (Chrome/Edge). No iOS (Safari) o usuário deve usar "Compartilhar → Adicionar à Tela de Início" manualmente.

## 6. Como Manusear o Código
*   **Design Pattern:** Single-File-Components por rota.
*   **Segurança de Sessão:** Proteção global no `<Layout>` (redireciona se sessão expirar). `<ProtectedRoute>` verifica `role === 'admin'`.
*   **RLS:** Camada server-side no Supabase. A função `is_admin()` (SECURITY DEFINER) é usada nas políticas para evitar recursão.
*   **Token QR:** Definido em `src/lib/checkinToken.js`. Compartilhado entre `Checkin.jsx` (validação) e `Admin.jsx` (geração do QR Code).
*   **ErrorBoundary:** Implementado em `main.jsx`. Crashes exibem tela amigável com botão de recarregar.
*   **Aparência:** Glassmorphism sutil, fontes `Plus Jakarta Sans` / `Manrope` via Google Fonts, ícones Material Symbols Outlined.
*   **Imagens estáticas:** Devem estar em `public/img-apoio/`. Arquivos fora de `public/` não são servidos pelo Vite.

## 7. Configuração de Deploy (Cloudflare Pages)

| Configuração | Valor |
|---|---|
| Build command | `npm run build` |
| Build output | `dist` |
| Node.js version | **20** (`.nvmrc` e `NODE_VERSION=20` nas env vars) |
| Env var 1 | `VITE_SUPABASE_URL` |
| Env var 2 | `VITE_SUPABASE_ANON_KEY` |

**Supabase → Authentication → URL Configuration:**
*   **Site URL:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev`
*   **Redirect URLs:** `https://larbeneficienteeuripedesbarsanulfo.pages.dev/dashboard` e `http://localhost:5173/dashboard`

> `package-lock.json` está no `.gitignore` — gerado localmente no Windows causa falha de build no Linux (Cloudflare). Nunca commitar o lock file.

## 8. Roadmap — Módulo Lanchonete (planejado)

Módulo a ser desenvolvido futuramente para a equipe da lanchonete da Casa. Acesso restrito por role dedicado (`lanchonete`), visível apenas para usuários com essa role e admins.

### Funcionalidades previstas (por prioridade):

1. **Cardápio/Produtos** — Cadastro de itens com nome e preço.
2. **Registro de Vendas** — Tela operacional (uso diário da responsável): seleciona produtos, define quantidade, registra venda. Funciona como um "carrinho" que vai acumulando durante o turno.
3. **Fechamento de Caixa** — Resumo do dia: total vendido, lista de vendas, valor esperado em caixa. Acessível também pelo Admin.
4. **Estoque** *(V2)* — Controle de quantidade disponível por item, alerta de estoque baixo.
5. **Relatórios** *(V2)* — Vendas por período, produto mais vendido.

---

## 9. Detalhamento de Implementação da Fila de Atendimento (V1.8 & V1.9)

### Funcionalidades do Módulo Fila de Atendimento
- **Previsão Dinâmica Baseada em Sessões Reais**: Cálculo em tempo real da estimativa de atendimento considerando a quantidade de salas ativas e atendimentos por sala.
- **Cálculo Automático da Data Prevista**: Mapeamento inteligente de dias da semana (Terça, Quarta e Quinta) para calcular as próximas datas disponíveis.
- **Exclusão do Mesmo Dia na Previsão Automática**: Se a consulta/cálculo de previsão for executado no mesmo dia da sessão, o algoritmo ignora o próprio dia e projeta automaticamente para as datas/semanas subsequentes.
- **Disponibilidade Opcional do Atendido**: Suporte a dados detalhados de restrição da pessoa (`p_dias_disponiveis`, `p_periodos_disponiveis`, `p_datas_indisponiveis`, `p_observacoes_disponibilidade`), exibidos em accordion recolhível nos modais.
- **Reagendamento Completo e RPC Transacional**:
  - RPC SQL `public.atendimento_reagendar()` transacional e segura.
  - Marca o agendamento anterior como `cancelado` com observação de auditoria, cria o novo agendamento com status `programado` e recalcula a fila em uma única transação atômica.
  - Rollback automático em caso de falha de validação ou restrição de capacidade.
- **Reorganização Automática da Fila**: Ao cancelar, agendar ou atender uma pessoa, o sistema recalcula imediatamente os `posicao_fila` restantes sem lacunas.
- **Histórico Administrativo e Auditoria**:
  - Tabela `atendimento_historico` como fonte única da verdade para auditoria.
  - Registro de previsões calculadas e ações realizadas com nomes de administradores e timestamptz.
- **Melhorias de Vocabulário & UX**:
  - Substituição padronizada de "Paciente" por "Pessoa".
  - Distinção entre "Novo Atendimento" (para a fila de espera) e "Programação Imediata / Encaixe Urgente".
- **Refinamento de Modais Operacionais**:
  - Modais "Programar Atendimento" e "Reagendar Atendimento" com reordenação de campos (1º Data do Atendimento, 2º Atendimento / Sessão).
  - O campo de sessão inicia desabilitado com a mensagem *"Selecione primeiro a data"* e é filtrado estritamente pelas sessões válidas do dia da semana local selecionado (`day_of_week` ou `event_date`).
  - Limpeza automática do valor da sessão selecionada caso a data seja alterada.
  - Desduplicação estrita de opções nos selects de sessão.
  - Rodapé fixo em dispositivos móveis respeitando safe-area, impedindo que a barra de navegação inferior cubra os botões de ação.
- **Visualização Operacional Limpa**:
  - Registros `cancelados` gerados por reagendamento ou cancelamento manual são ocultados por padrão da lista operacional diária "Todos os Atendimentos Programados", permanecendo 100% intactos no Banco de Dados e na aba "Histórico".
  - Indicação visual discreta em tom âmbar abaixo da data para agendamentos oriundos de reagendamento: `🔄 Reagendado de DD/MM/AAAA para DD/MM/AAAA`.
- **Agrupamento por Data e Identificação por Sala**:
  - Agrupamento visual das programações por Data e Trabalho.
  - Identificação de salas padronizada em badges pequenas: `Sala 1`, `Sala 2`, `Sala 3`.
  - Exibição de cabeçalho único do trabalho ("Apometria") por bloco para eliminar repetição.
- **Dashboard Operacional e Indicadores Rápidos**:
  - Painel superior com 4 cards de acesso rápido: *Pessoas na fila*, *Atendimentos programados*, *Atendimentos de hoje*, *Urgências pendentes*.
  - Barra de métricas secundárias: *Última atualização (HH:mm:ss)*, *Total da semana (54 vagas)* e *Taxa de ocupação (%)*.
  - Barra de progresso visual de ocupação por sessão (ex: `6 de 9 vagas ocupadas` | `[██████░░░]`).
- **Configuração de Vagas Recolhida**:
  - Accordion recolhido por padrão: `⚙ Configuração de vagas` | `6 sessões • 54 vagas semanais`.
- **Menu de Ações por Dropdown `[•••]`**:
  - Botão secundário `[•••]` em todas as tabelas e cards para ações de *Compareceu*, *Atendimento Realizado*, *Reagendar*, *Tornar Urgente*, *Retornar à Fila* e *Excluir da Fila*.
- **Modal Próprio de Exclusão da Fila**:
  - Eliminação completa de `window.confirm()` nativo.
  - Modal customizado com backdrop, card branco, ícone de alerta, botão neutro "Cancelar" e botão vermelho "Excluir da Fila" com feedback `Excluindo...`.

## 10. Atualizações na Administração de Médiuns e Gestores

- **Tradução Visual de Níveis de Acesso**:
  - Mapeamento centralizado de exibição `ROLE_LABELS`: `volunteer` → **Médium**, `admin` → **Administrador**, `manager` → **Gestor**, `lanchonete` → **Lanchonete**.
  - Mantidos os valores internos em inglês no banco de dados Supabase e em regras de RLS/autenticação.
- **Gestão Integrada de Convites e Status (Pendente / Ativo / Inativo)**:
  - Exibição de **convites pendentes** (`pre_cadastros`) diretamente na lista de Médiuns e Gestores com a badge de status **`Pendente`** (amarelo).
  - Permite aos Administradores visualizar todos os voluntários convidados que ainda não realizaram o 1º acesso ao aplicativo.
  - Ações para convites pendentes: **`Reenviar Convite`** (copia mensagem de WhatsApp com link) e **`Excluir Convite`** (remove da lista).
  - Transição automática: quando o médium realiza o 1º acesso e conclui o perfil, o status passa automaticamente de **`Pendente` → `Ativo`**.
  - Status operacional **`Ativo`** (verde) e **`Inativo`** (cinza) com controle por modal para administradores.
  - Resumo de contagens no topo da aba: `X cadastrados • Y ativos • Z pendentes • W inativos`.
  - Filtros rápidos por status (*Todos*, *Ativos*, *Pendentes*, *Inativos*) e por nível de acesso (*Médiuns*, *Gestores*, *Administradores*).

## 11. Decisões de Arquitetura e Projeto

1. **Separação entre Status Operacional e Acesso ao Sistema**: O campo `active` em `profiles` representa unicamente se o médium está trabalhando ativamente na Casa no momento. Ele nunca impede o login do usuário nem altera suas permissões de autenticação.
2. **Imutabilidade do Histórico**: Transações de reagendamento ou cancelamento criam/atualizam registros e registram a movimentação no histórico imutável (`atendimento_historico`), garantindo auditoria completa sem perda de dados.
3. **Limpeza da Lista Operacional**: Registros cancelados não pertencem à operação diária de recepção e triagem. Portanto, são ocultados da lista "Todos os Atendimentos Programados", permanecendo acessíveis unicamente no Histórico.
4. **Encaixe Urgente Fora da Fila de Espera**: Quando um atendimento urgente é cadastrado com programação imediata, ele é inserido diretamente na tabela de programações ativas sem transitar pela fila de espera regular.
5. **Cálculo Consistente de Previsão de Atendimento**: A previsão sempre considera sessões futuras oficiais da grade regular e calcula o tempo de espera aproximado com base na velocidade média de vazão das salas.
6. **Disponibilidade Opcional do Atendido**: O fornecimento de restrições de horários e dias pelo atendido é 100% opcional, garantindo fluxo rápido no cadastro presencial.
7. **Design de Baixo Ruído Visual**: A interface prioriza paleta sutil baseada em azul institucional, cores em badges para estados (`Ativo` verde, `Inativo` cinza, `Urgente` laranja), menus dropdown `[•••]` para ações secundárias e accordions para configurações acessadas com pouca frequência.

## 12. Estado Atual do Módulo "Fila de Atendimento"

### Funcionalidades Concluídas
- [x] Cadastro de Pessoas na Fila de Espera com prioridade Normal/Urgente e restrições opcionais.
- [x] Cálculo e exibição da Previsão Estimada em tempo real.
- [x] Modal de Programar Atendimento com seleção filtrada por dia da semana da data escolhida.
- [x] Modal de Reagendar Atendimento com transação atômica RPC no Supabase.
- [x] Cadastro Urgente com Programação Imediata.
- [x] Painel Dashboard Operacional com KPIs e ocupação de vagas.
- [x] Visualização em Lista agrupada por Data e identificação por Sala 1, Sala 2 e Sala 3.
- [x] Modal de confirmação próprio para Exclusão da Fila (sem `window.confirm()`).
- [x] Módulo "Médiuns e Gestores" com status Ativo/Inativo e tradução de níveis de acesso.

### Funcionalidades em Validação
- [ ] Validação presencial pelos administradores da Casa durante os atendimentos públicos de Terça, Quarta e Quinta-feira.

### Pendências Conhecidas / Melhorias Futuras
- [ ] **Formulário Público por Link (Pré-solicitação)**: Link gerado para Instagram/WhatsApp onde a pessoa solicita atendimento público sem login. Entra como `aguardando_analise` em uma fila prévia de triagem para revisão administrativa antes de ser promovido à Fila de Espera regular.
- [ ] **Biblioteca / Centro de Estudos (Melhoria Futura)**:
  - **Objetivo**: Criar um módulo permanente de materiais de estudo para os médiuns, utilizando a infraestrutura já existente do Portal.
  - **Motivação**: Disponibilização inicial do eBook de Apometria e futuros materiais de estudo da Casa.
  - **Implementação Prevista**:
    - Utilizar a tela Mural (`Messages.jsx`) como ponto de acesso aos materiais.
    - Manter o chat do mural para comunicação diária entre administração e médiuns.
    - Adicionar uma seção permanente denominada **"Materiais da Casa"** separada da área de mensagens (os materiais não ficam perdidos no fluxo de conversas).
    - Cada item terá: *Título*, *Descrição*, *Autor*, *Data da última atualização*, botão *Ler* e botão *Download* (opcional).
  - **Primeira Publicação Prevista**: eBook de Apometria desenvolvido para estudos da Casa.
  - **Evolução Futura**:
    - Expansão para Regulamento Interno, Manual do Médium, Apostilas, PDFs, Vídeos, Áudios e Comunicados Permanentes.
    - Funcionalidades desejadas em versões futuras: leitor interno de PDF, memorização da última página lida, busca por palavras-chave no texto, favoritos, histórico de leitura e categorias.
- [ ] Módulo Lanchonete (previsto para V2.0).
- [ ] Relatórios analíticos de frequência e fluxo de atendimento acumulado por mês.

---

## 13. Evolução V2.0 — Sistema de Check-in por Geolocalização (GPS)

*Status atualizado por: Inteligência Artificial (Antigravity).*  
*Fase atual: **V 2.0 — Check-in Principal migrado para Geolocalização (GPS) com Raio Configurável, Validação Server-Side RPC no Supabase, Janela de Horário e QR Code preservado como Fallback Operacional**.*

### Resumo Técnico da Evolução:
1. **Migração do Método Principal para Geolocalização**:
   - Substituição do destaque de QR Code na interface do voluntário pelo botão **"Fazer Check-in"** baseado na geolocalização do dispositivo (`navigator.geolocation`).
   - Validação da distância em metros em relação às coordenadas oficiais da Casa Espírita Apometria Elos de Amor e Paz.

2. **Área Administrativa e Captura de Coordenadas**:
   - Seção **"Localização para Check-in"** incorporada na aba de administração.
   - Campos editáveis: *Latitude*, *Longitude*, *Raio permitido (metros)*.
   - Botão **`[ Usar minha localização atual ]`**: captura as coordenadas GPS reais do administrador (quando fisicamente na Casa) utilizando `navigator.geolocation.getCurrentPosition` com alta precisão e exibição do nível de precisão obtido.
   - Raio padrão configurado para **100 metros**, editável sem necessidade de alteração de código.

3. **Validação Rígida Server-Side no Supabase (RPC)**:
   - Toda a confirmação de presença por geolocalização e QR code é processada exclusivamente através da RPC transacional `public.realizar_checkin(...)` no PostgreSQL ( SECURITY DEFINER ).
   - Sem fallback client-side para escrita em banco: se a RPC estiver indisponível ou retornar erro, nenhuma presença é gravada pelo frontend e o sistema direciona amigavelmente ao QR Code fallback.
   - Validações da RPC:
     - `auth.uid()` autenticado e válido.
     - Atendimento/Escala agendado para o dia da semana atual ou data específica do atendimento extra.
     - Confirmação prévia do voluntário vinculada na tabela `presencas` para o trabalho de hoje (registro gerado na confirmação pela Agenda com `qr_checkin = false`).
     - Ausência de check-in efetuado anteriormente (`qr_checkin = false`).
     - Janela de horário permitida: de **30 minutos antes** até **30 minutos depois** do `start_time` da atividade (calculado no fusorário `America/Sao_Paulo`).
     - Distância Haversine <= `casa_config.raio_metros`.

4. **Tratamento de Precisão do GPS e Erros do Dispositivo**:
   - Medição contínua da precisão (`coords.accuracy`). Caso a precisão inicial seja fraca (> 50m), o sistema executa releitura com a mensagem *"Estamos tentando obter uma localização mais precisa..."*.
   - Tratamento amigável para permissão de localização negada pelo usuário: *"Para confirmar sua presença automaticamente, permita o acesso à localização do dispositivo."* com opções `[Tentar novamente]` e `[Usar QR Code]`.
   - Tratamento para GPS indisponível / timeout: *"Não foi possível confirmar sua localização."* com opções `[Tentar novamente]` e `[Usar QR Code]`.
   - Exibição discreta de distância aproximada em metros quando o usuário tenta check-in fora do raio.

5. **Preservação Integral do QR Code (Fallback)**:
   - Nenhum componente, tabela, rota, lógica ou gerador do QR Code foi removido.
   - O QR Code permanece ativo como método alternativo operacional para casos excepcionais (voluntário sem GPS, bateria fraca ou falha de sinal).

6. **Privacidade dos Dados**:
   - Sem rastreamento contínuo em segundo plano e sem histórico de movimentação do voluntário.
   - Apenas a distância calculada e a precisão do GPS no momento do toque em "Fazer Check-in" são salvas junto à presença (`checkin_method`, `checkin_distance_meters`, `checkin_accuracy_meters`).

7. **Migration Criada e Executada com Sucesso**:
   - `migration_checkin_geolocation.sql` (100% Idempotente).
   - Executada com sucesso no Supabase SQL Editor em 10/08/2026 (`Success. No rows returned`).

### Detalhamento das Melhorias de Segurança Final (V2.2):
- **Isolação de Segredos (`casa_checkin_secret`)**: O token oficial do QR Code foi separado da tabela pública `casa_config` e armazenado na tabela protegida `casa_checkin_secret`.
- **RLS Restrito**: A tabela `casa_checkin_secret` possui RLS ativado sem permissão de `SELECT` para usuários comuns (`authenticated`). Apenas administradores (`is_admin()`) têm acesso direto via API. Voluntários não conseguem ler o token via PostgREST.
- **Validação Interna de QR Token na RPC**: Quando `p_method = 'qrcode'`, a função `SECURITY DEFINER` `realizar_checkin` lê o token da tabela `casa_checkin_secret` internamente e valida contra `p_qr_token`. Chamadas sem o token correto são rejeitadas server-side.
- **Validação de Limites de Coordenadas**: A RPC valida se `p_lat` está entre `-90.0` e `90.0` e `p_lng` entre `-180.0` e `180.0`.
- **Fuso Horário Isolado**: Variável `v_now_local TIMESTAMP WITHOUT TIME ZONE` baseada em `NOW() AT TIME ZONE 'America/Sao_Paulo'`.
- **Lock de Concorrência**: Seleção do registro prévio em `presencas` com `FOR UPDATE` em transação atômica.
- **Permissões Explícitas**: `REVOKE ALL ON FUNCTION ... FROM PUBLIC;` e `GRANT EXECUTE TO authenticated;`.
- **Schema Reload**: Comando `NOTIFY pgrst, 'reload schema';` incluído e executado.



