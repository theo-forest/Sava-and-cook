# Save & Cook — PRD

## Projet
Application full-stack IA permettant de transformer des vidéos YouTube de cuisine en recettes structurées, enrichies nutritionnellement et planifiables.

## Date de création : 2026-05-21

## Stack
- **Backend** : FastAPI + MongoDB (motor) + Python
- **Frontend** : React 19 + Tailwind CSS + Recharts
- **IA** : OpenAI GPT-4o-mini via `emergentintegrations` (EMERGENT_LLM_KEY)
- **YouTube** : `youtube-transcript-api` (sans clé API pour les transcriptions)
- **Nutrition** : Estimation LLM (Edamam prêt à intégrer avec app_id/app_key)

## Architecture
```
Frontend (React) → FastAPI backend → Pipeline 3 agents
                                      ├── RecipeExtractor (YouTube + LLM)
                                      ├── NutritionCalculator (LLM fallback)
                                      └── WeeklyPlanner (LLM suggestion)
                                   → MongoDB (videos, recipes, weekly_plans, processing_runs)
```

## Fonctionnalités implémentées (v1 - 2026-05-21)

### Backend
- `POST /api/videos/ingest` — Lance le pipeline (async background task)
- `GET /api/runs/{run_id}` — Statut/progression du pipeline
- `GET /api/recipes` — Liste des recettes (avec filtres tag/search)
- `GET /api/recipes/{id}` — Détail d'une recette
- `DELETE /api/recipes/{id}` — Suppression
- `GET /api/plans/{week}` — Plan hebdomadaire
- `POST /api/plans/{week}/slots` — Ajouter une recette au plan
- `DELETE /api/plans/{week}/slots/{slot_id}` — Retirer un slot
- `GET /api/plans/{week}/shopping-list` — Liste de courses agrégée (v2 - 2026-06-14)
- `GET /api/stats` — Statistiques globales
- `GET /api/health` — Health check

### Frontend
- **Page Extraction** (`/`) — URL YouTube + suivi progression pipeline temps réel
- **Bibliothèque** (`/recipes`) — Grille recettes avec filtres par tag
- **Détail recette** (`/recipes/:id`) — Ingrédients, étapes interactives, chart nutrition
- **Planificateur** (`/planner`) — Grille 7j × 3 repas, navigation semaines
- **Modal Liste de courses** — Cases à cocher + export PDF jsPDF (v2 - 2026-06-14)

### Collections MongoDB
- `videos` — Métadonnées + transcription YouTube (idempotent)
- `recipes` — Recettes structurées + nutrition intégrée
- `weekly_plans` — Plans hebdomadaires avec slots
- `processing_runs` — État du pipeline IA

## Variables d'environnement requises
```
EMERGENT_LLM_KEY=sk-emergent-... (fournie)
YOUTUBE_API_KEY= (optionnel — metadata seulement via oEmbed sans clé)
EDAMAM_APP_ID= (optionnel — fallback LLM actif)
EDAMAM_APP_KEY= (optionnel)
```

## Backlog P1 (prochaines itérations)
- [ ] Intégration Edamam API réelle (quand user fournit les clés)
- [ ] Favoris / notation des recettes
- [ ] Export liste de courses (PDF/CSV) depuis le plan hebdomadaire
- [ ] Filtre calories dans la bibliothèque
- [ ] Recherche avancée (durée, tags multiples)
- [ ] Copie de semaine en semaine dans le planificateur

## Backlog P2
- [ ] LangSmith pour observabilité des agents
- [ ] Cache LLM pour éviter re-traitement (déjà géré par idempotence video_id)
- [ ] Partage de recettes par lien public
- [ ] Import de recettes manuelles (sans YouTube)
