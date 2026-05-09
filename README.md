# Lingroove MVP

Lingroove helps users learn Spanish through music by importing lyrics, extracting vocabulary (verbs/nouns/adjectives), organizing songs in playlists, and exporting Anki-compatible CSV files.

## Monorepo Structure

- `apps/web`: Next.js + Tailwind frontend
- `apps/api`: FastAPI + spaCy + PostgreSQL backend
- `infra`: Docker Compose for local Postgres
- `.env.example`: shared environment variable template
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

## Environment Variables

Copy `.env.example` into `.env` and adjust as needed:

```bash
cp .env.example .env
```

Key vars:

- `DATABASE_URL`
- `API_HOST`
- `API_PORT`
- `CORS_ORIGINS`
- `SPACY_MODEL`
- `TRANSLATION_PROVIDER`
- `NEXT_PUBLIC_API_BASE_URL`

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
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

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

- `POST /api/v1/import-lyrics`
- `POST /api/v1/analyze-lyrics`
- `POST /api/v1/generate-anki`
- `POST /api/v1/playlist/create`
- `GET /api/v1/playlist/{id}`

## Example API Payloads

### POST `/api/v1/import-lyrics`

Request:

```json
{
  "sourceType": "raw",
  "sourceValue": "Quiero bailar toda la noche",
  "title": "Mi Cancion",
  "artist": "Artista",
  "userId": 1
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
{
  "songId": 10
}
```

Response (shape):

```json
{
  "songId": 10,
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