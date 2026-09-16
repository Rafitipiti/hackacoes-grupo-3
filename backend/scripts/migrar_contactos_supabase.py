"""Copia las fichas del Excel local a la tabla `contactos` de Supabase.

Uso (con SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno):

    python -m scripts.migrar_contactos_supabase

Es idempotente: cada ficha se guarda con upsert por empresa_id, así que
correrlo dos veces deja lo mismo. El Excel no se toca.
"""

import os
import sys

from app.services.contactos_service import ContactosExcel, ContactosSupabase


def main() -> int:
    url = os.getenv("SUPABASE_URL", "").strip()
    clave = os.getenv("SUPABASE_SERVICE_KEY", "").strip()

    if not url or not clave:
        print("Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.", file=sys.stderr)
        return 1

    origen = ContactosExcel()
    destino = ContactosSupabase(url, clave)

    fichas = origen.listar()
    for ficha in fichas:
        empresa_id = ficha.pop("empresa_id")
        ficha.pop("actualizado", None)
        destino.guardar(empresa_id, ficha)
        print(f"  {empresa_id}: migrada")

    print(f"{len(fichas)} ficha(s) copiadas a {url}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
