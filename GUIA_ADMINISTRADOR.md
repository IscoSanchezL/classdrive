# Class Drive — Guía del administrador

Esta guía es **solo para ti** (no se publica en el sitio). Reúne lo necesario para operar, publicar y cuidar la plataforma.

**Sitio:** https://classdrive.iscosanchez.com

---

## 1. Piezas del sistema
Todo vive en **Firebase** (proyecto `classdrive-981c2`):

| Pieza | Para qué sirve | Dónde se administra |
|---|---|---|
| **Firebase Hosting** | Sirve la página, con el dominio `classdrive.iscosanchez.com` | Consola de Firebase → Hosting |
| **Firebase Authentication** | Inicio de sesión con Google | Consola de Firebase → Authentication |
| **Firestore** | Guarda planeaciones, perfiles, respaldos y el portal de estudiantes | Consola de Firebase → Firestore |
| **GitHub** | Código e historial (`IscoSanchezL/classdrive`, rama `main`) | https://github.com/IscoSanchezL/classdrive |

Colecciones de Firestore: `user_data` (planeación de cada profesor), `profiles` (perfil y rol), `respaldos`, `plataforma` (configuración general), `aula_publica` (portal de estudiantes) y `resultados`. Los correos, en minúsculas, son los identificadores. Más detalle técnico en `docs/FIRESTORE.md`.

> **Supabase** (el proyecto *ClassDrive*) fue la base anterior. Ya no se usa; ver la sección 9.

---

## 2. Cómo se publica
**Publicar es hacer un `git push` a `main`.** GitHub Actions despliega solo en Firebase Hosting (archivo `.github/workflows/firebase-hosting-merge.yml`), normalmente en menos de un minuto. No hay que ejecutar nada en el Mac.

- **Vista previa:** cada *pull request* genera una dirección de prueba, sin tocar el sitio en vivo. Lo recomendable para cambios grandes.
- **Estado:** https://github.com/IscoSanchezL/classdrive/actions — el despliegue debe salir en verde.
- **Pruebas automáticas:** también corren en cada envío (`tests.yml`).
- **Después de publicar**, recarga con **Cmd + Shift + R** o abre una ventana de incógnito, para no ver una copia guardada del navegador.
- **Emergencia:** `./publicar.sh` publica desde el Mac sin pasar por GitHub (necesita `firebase login`). Solo como respaldo.

Las **reglas e índices de Firestore** se publican aparte, desde la carpeta del proyecto:
```
firebase deploy --only firestore
```

**Regla de oro:** todo lo que está en el repositorio se publica en el sitio, salvo lo que `firebase.json` ignora (`*.md`, `*.sql`, `publicar.sh`, archivos ocultos). No subas archivos temporales ni datos.

---

## 3. La Consola (botón 👑 Consola)
Solo la ven el administrador y los roles con permiso. Pestañas: **Resumen, Semana, Profesores, Planeaciones, Por fechas, Plataforma, Respaldos, Roles**.

- **Resumen** — cuántos profesores, clases planeadas, avance promedio y quién está activo.
- **Profesores** — lista, roles, y respaldo o restauración de cada uno.
- **Planeaciones / Por fechas** — avance de todos y las fechas en que se dio cada clase.
- **Roles** — define qué puede hacer cada rol. Solo el administrador cambia roles.
- **Respaldos** — respaldo general, restauración desde archivo y limpieza (ver sección 6).

---

## 4. Seguridad
- Las reglas están en `firestore.rules`: cada profesor ve y escribe **solo lo suyo**; el personal con consola **lee** lo de los demás; solo el administrador cambia roles y la configuración general. El portal de estudiantes se lee sin sesión.
- Las reglas se publican con `firebase deploy --only firestore` (sección 2). Cualquier cambio de reglas debe probarse antes (ver `docs/FIRESTORE.md`).
- Las claves de IA de los profesores **no** se suben a la nube: solo viven en el navegador de cada uno.
- **Restringir el acceso a cuentas del colegio:** en `index.html`, completa `const CD_ALLOWED_DOMAINS=[];` con el dominio, por ejemplo `['gi.edu.co']`, y publica. Tu cuenta de administrador siempre puede entrar.
- **Dominio autorizado:** `classdrive.iscosanchez.com` debe estar en Firebase → Authentication → Settings → Authorized domains. Si un profesor ve un error al iniciar sesión con Google, revisa primero eso.

---

## 5. Antes de abrirla a los 120 profesores
1. **Revisar el plan de Firebase** (sección 7). Es la decisión que más pesa ahora.
2. **Prueba escalonada:** que entren primero 5 a 10 profesores y que cada uno pulse **Ajustes → 🩺 Verificar que todo funciona**. Todos los pasos deben salir ✅ y por debajo de un par de segundos.
3. **Descargar una copia de seguridad** (sección 6).
4. Compartir **GUIA_DE_USO.md** con los profesores (por Drive o correo).

---

## 6. Respaldos y copias de seguridad
- **Automáticos:** 2 por día (10:00 y 14:00) por profesor, mientras trabaja. Cada profesor conserva los últimos 6 automáticos y 5 manuales/generales; la propia app borra el resto después de cada respaldo.
- **Limpieza manual de todos:** Consola → Respaldos → **🧹 Borrar respaldos antiguos**.
- **Copia descargada (la que de verdad te protege):** Consola → Respaldos → **🛟 Respaldar toda la plataforma ahora**. Descarga un archivo; guárdalo en tu Drive. La Consola te avisa cuántos días llevas sin descargar una; lo recomendado es **una por semana**.
- Los respaldos de la nube viven en el mismo proyecto de Firebase que los datos: si ese proyecto se perdiera, se irían con él. Por eso importa el archivo descargado.

---

## 7. Plan de Firebase y costos
Firestore tiene una cuota gratuita diaria de lecturas y escrituras (verifícala siempre en la consola de Firebase, porque puede cambiar). La app guarda unos segundos después de que un profesor deja de escribir; con muchos profesores editando el mismo día, **las escrituras diarias pueden acercarse al límite gratuito**. Cuando se supera, las operaciones fallan hasta el día siguiente y la app muestra el aviso rojo de que no se pudieron guardar los datos.

Recomendación para 120 profesores: pasar el proyecto al plan de pago por uso (**Blaze**) **con una alerta de presupuesto** en Google Cloud, para que nada se corte y puedas vigilar el gasto. Con este volumen de datos el costo esperado es bajo, pero compruébalo en el uso real de las primeras semanas (Firebase → Uso y facturación).

---

## 8. Cuando algo falla
| Síntoma | Qué mirar |
|---|---|
| Aviso rojo "No se pudieron cargar tus datos" | Pulsa 🩺 en Ajustes y revisa qué paso sale ❌. Revisa la cuota diaria de Firestore y el estado de https://status.firebase.google.com |
| 🩺 marca ❌ en "Sesión reconocida" | Que el dominio esté en *Authorized domains* (sección 4) y que las reglas de Firestore estén publicadas |
| Un profesor no puede guardar | Cuota agotada, o las reglas rechazan la operación: revisa Firestore → Reglas y los registros |
| Parte de la página se ve vacía en un computador | Abrir en incógnito: un bloqueador de anuncios puede esconder elementos. Regla del proyecto: nunca usar clases CSS que empiecen con `ad-`, `ads-`, `banner-`, `sponsor-`, `promo-` o `popup`; los prefijos propios son `cdp-`, `cw-`, `cg-`, `sc-` |
| Cambios publicados que no se ven | Revisa que el despliegue de GitHub Actions haya salido en verde; luego Cmd + Shift + R o incógnito |
| Un profesor perdió algo | Su botón **🛟 Respaldos**, o tú desde Consola → Profesores → restaurar |

**Para diagnosticar:** pide al profesor la captura del resultado de **🩺 Verificar que todo funciona**; indica exactamente qué paso falla.

---

## 9. Supabase (legado)
Supabase fue la base de datos anterior. Hoy **nada de la app lo usa**: la bandera `CD_DEFAULT_BACKEND` de `index.html` apunta a `'firestore'`. El proyecto en Supabase se pausó solo por inactividad.

- **No borres nada hasta confirmar que Firestore tiene todo:** en la Consola, el **Resumen** debe mostrar a todos tus profesores con sus clases planeadas, y una **copia general descargada** (sección 6) debe abrir bien.
- Un proyecto de Supabase del plan gratuito **pausado se puede reactivar durante 90 días**. Pasado ese plazo ya no, y solo queda descargar una copia. No cuesta mantenerlo pausado.
- **Orden seguro para retirarlo:** (1) confirmar lo anterior, (2) reactivarlo una vez desde el panel, descargar una copia final y volver a pausarlo, (3) borrarlo cuando hayan pasado varias semanas de uso normal en Firestore.
- Los archivos `supabase_*.sql` del repositorio son de esa etapa. No se publican en el sitio y se pueden conservar como referencia o eliminar del repositorio cuando se borre el proyecto.
- El botón **☁️ Migrar a Firestore** de la Consola solo sirve mientras exista el proyecto de Supabase; si lo borras, deja de tener función.
