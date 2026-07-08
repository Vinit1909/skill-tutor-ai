# Deployment Checklist

Required steps when merging this branch and deploying. These cannot be automated
from the development worktree — each is a one-time action at merge/deploy time.

## 1. Regenerate the root lockfile (deploy blocker)

This branch intentionally carries **no `package-lock.json`** (a worktree-local
lockfile breaks Next.js workspace-root detection). The dependencies `jose`,
`mermaid`, and `dompurify` were added to `package.json` but are **not in the old
root lockfile** — `npm ci` will fail until it's regenerated:

```bash
# at the repo root, after merging
npm install --legacy-peer-deps
git add package-lock.json
git commit -m "chore: regenerate lockfile with jose/mermaid/dompurify"
```

## 2. Deploy Firestore security rules (security critical)

`firestore.rules` (repo root) locks all data to its owner. Until deployed, the
database likely accepts unauthenticated reads/writes from anyone with the public
Firebase config:

```bash
firebase deploy --only firestore:rules
# or paste firestore.rules into Firebase Console → Firestore Database → Rules
```

After deploying, verify: an incognito browser console using the public config
must get `permission-denied` reading `users/{anyUid}/skillspaces`.

Note: API routes no longer read/write Firestore (they receive context from the
authenticated client and verify Firebase ID tokens) — locked rules will not
break them.

## 3. Environment variables

Mirror `.env.example` into the hosting platform's env settings. Two that matter
beyond the obvious:

- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` — also used **server-side** to verify ID
  tokens; without it, API routes fail closed in production.
- At least one LLM provider key (`GROQ_API_KEY` recommended as the volume
  workhorse; `NVIDIA_API_KEY` adds flagship-quality models on the critical
  routes — note its free tier is dev/trial credits, not production volume;
  `GOOGLE_API_KEY` adds vision + diagram fallback).

## 4. Platform limits

- `/api/chat/stream` sets `maxDuration: 60` — confirm the hosting plan allows
  60s serverless functions (Vercel Hobby may cap lower).
- Recommended hygiene: rotate the Groq/Google API keys used during development.
