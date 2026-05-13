# Lingroove

Lingroove helps users learn Spanish through music by importing lyrics, extracting vocabulary (verbs/nouns/adjectives), organizing songs in playlists, and exporting Anki-compatible CSV files.

## Monorepo Structure

- `apps/web`: Next.js + Tailwind frontend
- `apps/api`: FastAPI + spaCy + PostgreSQL backend
- `infra`: Docker Compose for local Postgres
- `.env.example`: environment variable template
- `docs/`: full project guide (Markdown + PDF)

## Project documentation

- **Markdown:** [docs/LINGROOVE_PROJECT_GUIDE.md](docs/LINGROOVE_PROJECT_GUIDE.md) — architecture, libraries, data model, API behavior, frontend pages, MVP vs future work.
- **PDF:** [docs/LINGROOVE_PROJECT_GUIDE.pdf](docs/LINGROOVE_PROJECT_GUIDE.pdf) — same content, formatted for reading or sharing.

To regenerate the PDF after editing the Markdown (requires [ReportLab](https://www.reportlab.com/)):

```bash
python3 -m pip install reportlab
python3 docs/build_pdf.py
```

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Alembic, spaCy
- Database: PostgreSQL
- Auth: JWT (HS256) via `python-jose`, passwords hashed with `bcrypt`

## Environment Variables

### First-time setup

**Step 1** — Copy the example file:

```bash
cp .env.example .env
```

**Step 2** — Generate a secret key and paste it into `.env`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Open `.env` and set:

```
SECRET_KEY=<paste the output here>
```

`SECRET_KEY` has no default. The backend will refuse to start if it is missing or empty. Every developer and every deployment environment needs its own unique value.

**Step 3** — Make sure `.env` is in `.gitignore`. Never commit it. The secret key in `.env` is the only thing preventing someone from forging login tokens for any account.

### Variable reference

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | **Yes** | JWT signing secret. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins |
| `API_HOST` / `API_PORT` | No | Backend bind address (defaults: `0.0.0.0` / `8000`) |
| `SPACY_MODEL` | No | spaCy language model (default: `es_core_news_md`) |
| `TRANSLATION_PROVIDER` | No | Translation backend (default: `google`) |
| `NEXT_PUBLIC_API_BASE_URL` | No | API base URL used by the frontend (default: `http://localhost:8000/api/v1`) |

## Security notes

- **JWT auth:** All data routes require a `Authorization: Bearer <token>` header. Tokens are issued on signup/login and expire after 7 days.
- **Secret key:** The server refuses to start with the default `SECRET_KEY` when `APP_ENV=production`. See above for how to generate one.
- **Passwords:** Hashed with bcrypt (work factor 12). Passwords are limited to 72 bytes to prevent silent bcrypt truncation.
- **Timing-safe login:** The login endpoint always runs bcrypt (real or dummy) so response time does not reveal whether an email is registered.
- **Ownership enforcement:** Every route scopes queries to the authenticated user. Accessing another user's resource by ID returns 403.
- **Secrets:** Never commit `.env`. Use strong database credentials and rotate them in production.
- **Lyrics URL import:** The backend only allows `http`/`https` and blocks obvious loopback, private, and link-local hosts. A hostname that resolves to an internal address is not fully blocked unless you add DNS-resolution checks or proxy the fetch.
- **Error responses:** Import failures return short, fixed client messages; full tracebacks are logged server-side only.
- **CORS:** `CORS_ORIGINS` should list explicit frontend origins. Avoid pairing wildcard origins with credentials in production.

## Local Setup

### 1) Start Postgres

```bash
cd infra
docker compose up -d
```

### 2) Run backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
python -m spacy download es_core_news_md
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3) Run frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.  
Backend runs on `http://localhost:8000`.

## Start After Installation

Use this flow for normal day-to-day startup after the initial setup is complete.

### 1) Start Postgres (if not already running)

```bash
cd infra
docker compose up -d
```

### 2) Start backend

```bash
cd apps/api
source .venv/bin/activate
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run `alembic upgrade head` whenever Postgres is new or empty (e.g. after `docker compose down -v` or a fresh volume).

### 3) Start frontend

```bash
cd apps/web
npm run dev
```

### Optional health checks

- Backend: `http://localhost:8000/health`
- Frontend: `http://localhost:3000`

### If you changed DB schema

```bash
cd apps/api
source .venv/bin/activate
alembic upgrade head
```

## Core API Endpoints

All routes except `/auth/signup`, `/auth/login`, and `/health` require:

```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/auth/signup` | Create account, returns JWT |
| `POST` | `/api/v1/auth/login` | Authenticate, returns JWT |
| `GET` | `/api/v1/auth/me` | Current user profile |

### Songs & Lyrics

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/import-lyrics` | Import lyrics from URL or raw text |
| `GET` | `/api/v1/songs` | List authenticated user's songs |
| `GET` | `/api/v1/songs/{id}/analysis` | Saved lyrics + vocabulary |
| `POST` | `/api/v1/analyze-lyrics` | Run NLP analysis on a song |
| `POST` | `/api/v1/generate-anki` | Generate Anki CSV download |

### Playlists

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/playlists` | List authenticated user's playlists |
| `POST` | `/api/v1/playlist/create` | Create a playlist |
| `GET` | `/api/v1/playlist/{id}` | Get playlist with songs |
| `PATCH` | `/api/v1/playlist/{id}` | Rename a playlist |
| `DELETE` | `/api/v1/playlist/{id}` | Delete a playlist |
| `POST` | `/api/v1/playlist/{id}/songs` | Add song to playlist |
| `DELETE` | `/api/v1/playlist/{id}/songs/{song_id}` | Remove song from playlist |
| `GET` | `/api/v1/playlist/{id}/export-csv` | Export playlist vocabulary as CSV |

## Example API Payloads

### POST `/api/v1/auth/signup`

Request:

```json
{
  "email": "user@example.com",
  "display_name": "Jane",
  "password": "mysecretpassword"
}
```

Response:

```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

### POST `/api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "mysecretpassword"
}
```

Response:

```json
{ "access_token": "<jwt>", "token_type": "bearer" }
```

### POST `/api/v1/import-lyrics`

Request (with `Authorization: Bearer <token>`):

```json
{
  "sourceType": "raw",
  "sourceValue": "Quiero bailar toda la noche",
  "title": "Mi Cancion",
  "artist": "Artista"
}
```

Response:

```json
{
  "songId": 10,
  "lyricId": 12,
  "cleanedLyrics": "Quiero bailar toda la noche",
  "detectedLanguage": "es"
}
```

### POST `/api/v1/analyze-lyrics`

Request:

```json
{ "songId": 10 }
```

Response (shape):

```json
{
  "songId": 10,
  "cleanedLyrics": "Quiero bailar toda la noche",
  "grouped": {
    "verb": [
      {
        "id": 1,
        "originalWord": "bailar",
        "infinitiveForm": "bailar",
        "englishTranslation": "to dance",
        "contextSentence": "Quiero bailar toda la noche",
        "partOfSpeech": "verb",
        "isSelected": true
      }
    ]
  },
  "entries": []
}
```

### POST `/api/v1/generate-anki`

Request:

```json
{
  "songId": 10,
  "selectedVocabularyIds": [1, 2, 3]
}
```

Response: CSV file download with columns:

- Spanish Word
- English Translation
- Context Sentence
- Part of Speech
- Infinitive Form (if applicable)
