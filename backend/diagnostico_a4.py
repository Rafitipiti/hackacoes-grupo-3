from app.data.loader import cargar_datos_coes


datos = cargar_datos_coes()


for nombre in [
    "entregas",
    "retiros",
    "puntos_entrega",
    "costos_marginales_diario",
    "costos_marginales_15min",
]:

    df = datos[nombre]

    print("\n" + "=" * 70)
    print(nombre.upper())
    print("=" * 70)

    print("\nCOLUMNAS:")
    print(list(df.columns))

    print("\nPRIMEROS 3 REGISTROS:")
    print(df.head(3).to_string(index=False))
