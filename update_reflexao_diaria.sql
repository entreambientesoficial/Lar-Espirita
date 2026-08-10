-- ============================================================
-- Migration Idempotente: Atualizar Frase da Reflexão do Dia
-- Projeto: Portal do Voluntário - Apometria Elos de Amor e Paz
-- Executar no Supabase SQL Editor
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.reflexao_diaria (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quote TEXT NOT NULL,
  author TEXT NULL,
  image_url TEXT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.reflexao_diaria (id, quote, author, image_url)
VALUES (
  1,
  'O mundo exterior é o espelho exato do seu estado de espírito. Quando você desacelera e limpa as energias densas, a sua verdadeira Natureza Divina — que é saudável, pacífica e intocável — se manifesta. Você não é o cansaço que sente hoje; você é a luz que habita atrás dele. Sintonize-se com a harmonia e desfaça os nós do passado.',
  'Lauro Michielin - Espírito Luigi Santi Campo',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
)
ON CONFLICT (id) DO UPDATE
SET quote = EXCLUDED.quote,
    author = EXCLUDED.author,
    updated_at = now();

NOTIFY pgrst, 'reload schema';

COMMIT;
