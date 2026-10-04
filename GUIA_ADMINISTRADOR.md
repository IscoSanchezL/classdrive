# Class Drive — Guía del administrador

Esta guía es **solo para ti** (no se publica en el sitio). Reúne lo necesario para operar, publicar y cuidar la plataforma.

---

## 1. Cómo se publica
El proyecto vive en GitHub: https://github.com/IscoSanchezL/classdrive (rama `main`) y se publica en Firebase Hosting: https://classdrive-981c2.web.app

**Primera vez en un Mac**
```
mkdir -p ~/Desktop/ClassDrive
cd ~/Desktop/ClassDrive
git clone https://github.com/IscoSanchezL/classdrive proyecto
cd proyecto
```
Necesitas `git` y Firebase CLI (`npm install -g firebase-tools`, luego `firebase login`).

**Cada vez que haya cambios**
```
cd ~/Desktop/ClassDrive/proyecto
./publicar.sh
```
Trae lo último de `main` y publica. Al terminar: recarga con **Cmd + Shift + R**. Para comprobar qué versión tienes: `git log --oneline -1`.

---

## 2. Piezas del sistema
| Pieza | Para qué sirve | Dónde se administra |
|---|---|---|
| **Firebase Hosting** | Sirve la página | Consola de Firebase, proyecto `classdrive-981c2` |
| **Firebase Auth** | Inicio de sesión con Google | Consola de Firebase |
| **Supabase** (proyecto *ClassDrive*) | Guarda planeaciones, perfiles y respaldos | https://supabase.com/dashboard/project/pexlhyunjvggychywrst |
| **GitHub** | Código e historial | Repositorio `IscoSanchezL/classdrive` |

Tablas en Supabase: `user_data` (planeación de cada profesor), `profiles` (perfiles y roles), `respaldos`, `plataforma` (configuración general), `aula_publica` (portal de estudiantes), `Resultados`.

---

## 3. La Consola (botón 👑 Consola)
Solo la ven el administrador y los roles con permiso. Pestañas: **Resumen, Semana, Profesores, Planeaciones, Por fechas, Plataforma, Respaldos, Roles**.

- **Resumen** — cuántos profesores, clases planeadas, avance promedio y quién está activo.
- **Profesores** — lista, roles, y respaldo o restauración de cada uno.
- **Planeaciones / Por fechas** — avance de todos y las fechas en que se dio cada clase.
- **Roles** — define qué puede hacer cada rol. Solo el administrador cambia roles.
- **Respaldos** — respaldo general, restauración desde archivo y limpieza (ver sección 5).

---

## 4. Seguridad (ya aplicada)
- Cada profesor solo ve y modifica **lo suyo**. El personal con consola puede **leer** los datos de otros; solo el administrador cambia roles, la configuración general y borra perfiles.
- Supabase reconoce a cada profesor por su sesión de Google (Third-Party Auth con Firebase). En `index.html`: `const CD_SECURE=true;`.
- Las claves de IA de los profesores **no** se suben a la nube.
- El portal de estudiantes (`aula_publica`) es de lectura pública; cada profesor solo escribe el suyo.
- Para limitar el acceso a cuentas del colegio, en `index.html` completa `const CD_ALLOWED_DOMAINS=[];` con el dominio, por ejemplo `['gi.edu.co']`, y vuelve a publicar. (Tu cuenta de administrador siempre puede entrar.)

**Si algo se rompe tras un cambio de seguridad:** ejecuta `supabase_seguridad_revertir.sql` en el SQL Editor de Supabase, pon `CD_SECURE=false` y publica. Los scripts `supabase_seguridad.sql`, `supabase_rendimiento.sql` y `supabase_schema.sql` documentan lo aplicado.

---

## 5. Respaldos y copias de seguridad
- **Automáticos:** 2 por día (10:00 y 14:00) por profesor, mientras trabaja. Se conservan los últimos 6 automáticos y 5 manuales/generales. Una limpieza nocturna (2:30 a. m.) borra el resto.
- **Limpieza manual:** Consola → Respaldos → **🧹 Borrar respaldos antiguos**.
- **Copia descargada (la que de verdad te protege):** Consola → Respaldos → **🛟 Respaldar toda la plataforma ahora**. Guarda copias en la nube y **descarga un archivo** para que lo pongas en tu Drive. La Consola te avisa cuántos días llevas sin descargar una; lo recomendado es **una por semana**.
- Los respaldos de la nube están en la misma base de datos que los datos: si el proyecto de Supabase se perdiera, se irían con él. Por eso importa el archivo descargado.

---

## 6. Plan de Supabase
- **Gratuito:** se pausa tras una semana con poca actividad. Se reactiva en el panel (Resume project) durante 90 días; después solo se puede descargar una copia y montarla en un proyecto nuevo. Mientras está pausado, la app muestra el aviso rojo de que no se pudieron cargar los datos.
- **Pro:** no se pausa e incluye copias diarias de Supabase. Es lo recomendable con 120 profesores.

---

## 7. Antes del lanzamiento a los 120 profesores
1. Decidir el plan de Supabase (sección 6).
2. Prueba escalonada: que entren primero 5 a 10 profesores y que cada uno pulse **Ajustes → 🩺 Verificar que todo funciona**. Todos los pasos deben salir ✅ y por debajo de un par de segundos.
3. Descargar una copia de seguridad (sección 5).
4. Revisar lo que se publica: `ls ~/Desktop/ClassDrive/proyecto` — todo lo que está en esa carpeta se publica en el sitio, salvo lo que `firebase.json` ignora (`*.sql`, `*.md`, `publicar.sh`, archivos ocultos).
5. Compartir **GUIA_DE_USO.md** con los profesores (por Drive o correo).

---

## 8. Cuando algo falla
| Síntoma | Qué mirar |
|---|---|
| Aviso rojo "No se pudieron cargar tus datos" | ¿El proyecto de Supabase está pausado? ¿Falló la sesión? Pulsa 🩺 en Ajustes y revisa qué paso sale ❌. |
| 🩺 marca ❌ en "Sesión de Google reconocida" | Revisa en Supabase → Authentication → Third-Party Auth que Firebase siga configurado con `classdrive-981c2`. |
| Parte de la página se ve vacía en un computador | Abrir en ventana de incógnito: un bloqueador de anuncios puede esconder elementos. Regla del proyecto: nunca usar clases CSS que empiecen con `ad-`, `ads-`, `banner-`, `sponsor-`, `promo-` o `popup`; los prefijos propios son `cdp-`, `cw-`, `cg-`, `sc-`. |
| Cambios publicados que no se ven | Cmd + Shift + R, o ventana de incógnito. Confirma con `git log --oneline -1`. |
| Un profesor perdió algo | Su botón **🛟 Respaldos**, o tú desde Consola → Profesores → restaurar. |

**Para diagnosticar:** pide al profesor la captura del resultado de **🩺 Verificar que todo funciona**; indica exactamente qué paso falla.
