
ALTER TABLE public.bot_settings DROP CONSTRAINT IF EXISTS bot_settings_user_id_fkey;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_user_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE public.auto_replies DROP CONSTRAINT IF EXISTS auto_replies_user_id_fkey;
ALTER TABLE public.broadcasts DROP CONSTRAINT IF EXISTS broadcasts_user_id_fkey;
ALTER TABLE public.broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_user_id_fkey;

INSERT INTO public.bot_settings (user_id)
VALUES ('00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;
