# Setup

Short setup for local development.

## Prereqs

- Docker + Docker Compose
- Bun

## 1) Configure API keys

Edit `apps/server/.env.dev`:

- `OPENAI_API_KEY` (your OpenRouter key)
- `OPENAI_BASE_URL="https://openrouter.ai/api/v1"`
- `OPENAI_MODEL` (example: `openai/gpt-4o`)

## 2) Start backend stack

From repo root:

```bash
docker compose -f apps/server/docker-compose.dev.yml up -d
```

This starts Postgres + MinIO + backend.

## 3) Create MinIO bucket

Open the MinIO console:

- URL: `http://localhost:9001`
- User: `minioadmin`
- Pass: `minioadmin`

Create bucket:

- Name: `underwriting-documents`

Note: The `minio-init` service in `apps/server/docker-compose.dev.yml` can auto-create this bucket on startup.

## 4) Run web app

From repo root:

```bash
bun install
bun run dev
```

## 5) Useful URLs

- Web app: `http://localhost:3000`
- API: `http://localhost:3001/api`
- MinIO console: `http://localhost:9001`

## 6) Troubleshooting

- If uploads fail with `NoSuchBucket`, create `underwriting-documents` in MinIO.
- If auth token resets on refresh, reconnect wallet (token stored in localStorage).
- If LLM returns 401, verify OpenRouter key + base URL in `apps/server/.env.dev`.
