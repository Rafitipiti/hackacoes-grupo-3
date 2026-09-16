-- Fichas de contacto por empresa (portal COES Hub, spec §12).
--
-- Ejecutar una vez en el editor SQL del proyecto Supabase. El backend
-- accede con la clave de servicio (SUPABASE_SERVICE_KEY), que salta las
-- políticas de fila; la tabla no se expone a los navegadores, así que
-- RLS queda activo sin políticas: nadie con la clave anónima puede leerla.

create table if not exists public.contactos (
  empresa_id     text primary key,
  razon_social   text,
  ruc            text,
  banco          text,
  tipo_cuenta    text,
  moneda         text,
  numero_cuenta  text,
  cci            text,
  correos        text,
  telefonos      text,
  notas          text,
  actualizado    text
);

comment on table public.contactos is
  'Ficha de contacto y cuentas por empresa. Una fila por empresa_id (EMPRESA_NNN).';

alter table public.contactos enable row level security;
