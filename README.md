# Class Drive

Gestor de clases y recursos escolares.

| Pieza | Dónde |
|---|---|
| Código | Este repo (rama `main`) |
| Publicación | Firebase Hosting, proyecto `classdrive-981c2` |
| Login | Firebase Authentication |
| Datos | Supabase (esquemas en `supabase_*.sql`) |

## Publicar

Un `git push` a `main` publica solo, con GitHub Actions (`.github/workflows/deploy.yml`).
No se publica a mano. `publicar.sh` queda como respaldo de emergencia.

Requiere el secreto `FIREBASE_SERVICE_ACCOUNT_CLASSDRIVE_981C2` en
Settings → Secrets and variables → Actions.
