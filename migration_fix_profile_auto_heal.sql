-- MIGRATION: Auto-recuperação de perfis para e-mails pré-cadastrados

-- 1. Atualizar a trigger de novo usuário no auth.users para usar LOWER() e ILIKE
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
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    phone = COALESCE(profiles.phone, EXCLUDED.phone);
  RETURN new;
END;
$$;

-- 2. Trigger em pre_cadastros: Se o admin cadastrar um e-mail que já tentou logar no auth.users antes
CREATE OR REPLACE FUNCTION public.handle_new_pre_cadastro()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, phone)
  SELECT
    u.id,
    COALESCE(NEW.name, split_part(u.email, '@', 1)),
    u.email,
    COALESCE(NEW.role, 'volunteer'),
    NEW.phone
  FROM auth.users u
  WHERE lower(u.email) = lower(NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    phone = COALESCE(profiles.phone, EXCLUDED.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pre_cadastro_created ON public.pre_cadastros;
CREATE TRIGGER on_pre_cadastro_created
  AFTER INSERT ON public.pre_cadastros
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_pre_cadastro();
