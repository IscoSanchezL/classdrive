# Class Drive: datos en Firestore

Los datos de Class Drive están en **Firestore** (proyecto `classdrive-981c2`). Antes estaban en Supabase.
El login sigue siendo Firebase Authentication (Google).

## Cómo funciona
- `cdb.js` es un adaptador: la app sigue llamando `sb.from('tabla')…`, pero las llamadas leen y escriben en Firestore.
- Los campos JSON (`state`, `trash`, `settings`, `data`, `config`) se guardan como **texto JSON** (Firestore no admite listas dentro de listas).
- Los correos son los identificadores de documento, en minúsculas.
- Qué base se usa lo decide la bandera `CD_DEFAULT_BACKEND` en `index.html` (`'supabase'` o `'firestore'`).
  Se puede probar sin afectar a nadie con `?backend=firestore` al final de la dirección (queda guardado en ese navegador);
  `?backend=supabase` vuelve atrás.

## Colecciones
| Colección | Documento | Contenido |
|---|---|---|
| `user_data` | correo del profesor | planeación (`state`), papelera, ajustes, `rev` |
| `profiles` | correo | nombre, foto, rol |
| `respaldos` | id automático | copias de la planeación |
| `plataforma` | `1` | configuración general |
| `aula_publica` | correo | copia pública para estudiantes |
| `resultados` | id automático | resultados de actividades (solo escritura) |

## Seguridad
`firestore.rules` equivale a `supabase_seguridad.sql`: cada profesor ve y escribe solo lo suyo; el personal con consola
lee lo de los demás; solo el administrador cambia roles. El aula pública se lee sin sesión.
Publicar reglas e índices (desde la carpeta del proyecto, con la sesión de Firebase iniciada):

```bash
firebase deploy --only firestore
```

## Pruebas
```bash
node --test tests/cdb.test.mjs        # adaptador, con un Firestore simulado
```
Las reglas se prueban con el emulador (necesita Java): en una carpeta aparte instalar
`firebase-tools`, `@firebase/rules-unit-testing` y `firebase`, copiar `firestore.rules` y `tests/rules.test.mjs`,
levantar `firebase emulators:start --only firestore --project demo-classdrive` (puerto 8085) y ejecutar
`node rules.test.mjs`.

## Migrar los datos desde Supabase
1. Publicar reglas e índices (arriba).
2. Entrar como administrador → Consola → **☁️ Migrar a Firestore**. Copia perfiles, planeaciones, aula pública,
   configuración y respaldos, verifica cada documento y se puede repetir sin riesgo (no pisa lo igual o más nuevo).
3. Probar con `?backend=firestore`.
4. Cuando todo funcione, cambiar `CD_DEFAULT_BACKEND` a `'firestore'` y publicar.
5. Dejar el proyecto de Supabase pausado un tiempo como red de seguridad antes de borrarlo.
