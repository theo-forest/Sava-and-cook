"""
Save & Cook — Pipeline multi-agents LangGraph-like
3 agents séquentiels : RecipeExtractor → NutritionCalculator → WeeklyPlanner
"""
import asyncio
import json
import logging
import re
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

def extract_video_id(url: str) -> Optional[str]:
    patterns = [
        r"youtube\.com/watch\?v=([^&\n?#]+)",
        r"youtu\.be/([^&\n?#]+)",
        r"youtube\.com/embed/([^&\n?#]+)",
        r"youtube\.com/shorts/([^&\n?#]+)",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


async def fetch_youtube_metadata(url: str) -> dict:
    """Titre + chaîne via l'API oEmbed (sans clé)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://www.youtube.com/oembed?url={url}&format=json"
            )
            if resp.status_code == 200:
                d = resp.json()
                return {"title": d.get("title", ""), "channel": d.get("author_name", "")}
    except Exception as e:
        logger.warning(f"oEmbed failed: {e}")
    return {"title": "Recette YouTube", "channel": ""}


def _fetch_transcript_sync(video_id: str) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
    try:
        transcripts = YouTubeTranscriptApi.list_transcripts(video_id)
        # Essai FR puis EN
        for lang in ["fr", "fr-FR", "en", "en-US"]:
            try:
                t = transcripts.find_transcript([lang])
                data = t.fetch()
                return " ".join([item["text"] for item in data])
            except Exception:
                continue
        # Prend le premier disponible
        t = transcripts.find_generated_transcript(["fr", "en"])
        data = t.fetch()
        return " ".join([item["text"] for item in data])
    except (NoTranscriptFound, TranscriptsDisabled) as e:
        raise ValueError(f"Aucune transcription disponible pour cette vidéo: {e}")
    except Exception as e:
        raise ValueError(f"Erreur lors de la récupération de la transcription: {e}")


async def fetch_transcript(video_id: str) -> str:
    return await asyncio.to_thread(_fetch_transcript_sync, video_id)


def parse_json_response(text: str) -> dict:
    """Extrait le JSON d'une réponse LLM (avec ou sans bloc markdown)."""
    # Bloc markdown ```json ... ```
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return json.loads(m.group(1))
    # JSON brut
    text = text.strip()
    # Cherche le premier { ou [
    start = min(
        (text.find("{") if "{" in text else len(text)),
        (text.find("[") if "[" in text else len(text)),
    )
    if start < len(text):
        return json.loads(text[start:])
    return json.loads(text)


async def call_llm(system_msg: str, user_msg: str, session_id: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini")

    response = await chat.send_message(UserMessage(text=user_msg))
    return response


async def update_run(db, run_id: str, **kwargs):
    kwargs["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.processing_runs.update_one({"run_id": run_id}, {"$set": kwargs})


# ─── Agent 1 : RecipeExtractor ───────────────────────────────────────────────

RECIPE_SYSTEM = """Tu es un chef cuisinier expert et un parseur de recettes. 
À partir d'une transcription de vidéo YouTube de cuisine, extrait la recette structurée.

Réponds UNIQUEMENT avec un objet JSON valide (sans texte avant ou après):
{
  "title": "Nom de la recette",
  "servings": 4,
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "ingredients": [
    {"name": "farine", "quantity": "200", "unit": "g", "notes": ""}
  ],
  "steps": ["Étape 1...", "Étape 2..."],
  "tags": ["tag1", "tag2"]
}

Si la vidéo ne contient pas de recette de cuisine, réponds: {"error": "Pas une recette de cuisine"}
Les tags possibles: végétarien, vegan, sans-gluten, rapide, dessert, entrée, plat-principal, petit-déjeuner, déjeuner, dîner, économique, healthy
Toutes les valeurs doivent être en français."""


async def agent_recipe_extractor(state: dict, run_id: str) -> dict:
    video_url = state["video_url"]
    video_id = extract_video_id(video_url)

    if not video_id:
        state["errors"].append("URL YouTube invalide")
        return state

    # Métadonnées + transcription en parallèle
    meta_task = asyncio.create_task(fetch_youtube_metadata(video_url))
    transcript_task = asyncio.create_task(fetch_transcript(video_id))

    try:
        video_meta = await meta_task
        transcript = await transcript_task
    except ValueError as e:
        meta_result = await meta_task if not meta_task.done() else meta_task.result()
        state["errors"].append(str(e))
        return state

    state["video_id"] = video_id
    state["video_meta"] = video_meta
    state["transcript"] = transcript

    # Tronquer si trop long (limite token)
    max_chars = 12000
    if len(transcript) > max_chars:
        transcript = transcript[:max_chars] + "..."

    logger.info(f"[RecipeExtractor] Calling LLM for {video_id}")
    raw = await call_llm(
        system_msg=RECIPE_SYSTEM,
        user_msg=f"Transcription:\n\n{transcript}",
        session_id=f"recipe-{run_id}-extract",
    )

    try:
        recipe_data = parse_json_response(raw)
        if "error" in recipe_data:
            state["errors"].append(recipe_data["error"])
            return state
        state["extracted_recipe"] = recipe_data
    except Exception as e:
        state["errors"].append(f"Erreur d'extraction: {e}. Réponse LLM: {raw[:200]}")

    return state


# ─── Agent 2 : NutritionCalculator ──────────────────────────────────────────

NUTRITION_SYSTEM = """Tu es nutritionniste spécialisé. Estime les valeurs nutritionnelles par portion.

Réponds UNIQUEMENT avec un objet JSON valide:
{
  "calories": 450,
  "protein_g": 25.0,
  "carbs_g": 45.0,
  "fat_g": 15.0,
  "fiber_g": 5.0,
  "source": "estimation_llm"
}"""


async def agent_nutrition_calculator(state: dict, run_id: str) -> dict:
    recipe = state.get("extracted_recipe")
    if not recipe:
        state["nutrition"] = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "source": "unavailable"}
        return state

    ingredients_text = "\n".join(
        [f"- {i.get('quantity','')} {i.get('unit','')} {i['name']}" for i in recipe.get("ingredients", [])]
    )

    logger.info(f"[NutritionCalculator] Calling LLM for {recipe.get('title')}")
    raw = await call_llm(
        system_msg=NUTRITION_SYSTEM,
        user_msg=f"Recette: {recipe['title']}\nPortions: {recipe.get('servings', 4)}\nIngrédients:\n{ingredients_text}",
        session_id=f"recipe-{run_id}-nutrition",
    )

    try:
        nutrition = parse_json_response(raw)
        state["nutrition"] = nutrition
    except Exception as e:
        logger.warning(f"Nutrition parse error: {e}")
        state["nutrition"] = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "source": "error"}

    return state


# ─── Agent 3 : WeeklyPlanner ─────────────────────────────────────────────────

PLANNER_SYSTEM = """Tu es un planificateur de repas intelligent. Suggère le meilleur placement hebdomadaire pour une recette.

Réponds UNIQUEMENT avec un objet JSON valide:
{
  "day_of_week": 1,
  "meal_type": "lunch",
  "reason": "Explication courte en français"
}

day_of_week: 0=Lundi, 1=Mardi, 2=Mercredi, 3=Jeudi, 4=Vendredi, 5=Samedi, 6=Dimanche
meal_type: "breakfast", "lunch" ou "dinner"
"""


async def agent_weekly_planner(state: dict, db, run_id: str) -> dict:
    recipe = state.get("extracted_recipe", {})
    nutrition = state.get("nutrition", {})

    # Récupère le plan actuel
    today = datetime.now(timezone.utc)
    week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
    plan_doc = await db.weekly_plans.find_one({"week_start": week_start})
    slots_summary = ""
    if plan_doc:
        occupied = [(s["day_of_week"], s["meal_type"]) for s in plan_doc.get("slots", [])]
        slots_summary = f"Slots déjà occupés: {occupied}"
    else:
        slots_summary = "Aucun repas planifié cette semaine."

    logger.info(f"[WeeklyPlanner] Calling LLM for {recipe.get('title')}")
    raw = await call_llm(
        system_msg=PLANNER_SYSTEM,
        user_msg=(
            f"Recette: {recipe.get('title','')}\n"
            f"Tags: {', '.join(recipe.get('tags',[]))}\n"
            f"Calories/portion: {nutrition.get('calories', 0)} kcal\n"
            f"Temps de préparation: {recipe.get('prep_time_minutes', 0)} min\n"
            f"Plan actuel: {slots_summary}"
        ),
        session_id=f"recipe-{run_id}-planner",
    )

    try:
        suggestion = parse_json_response(raw)
        state["planning_suggestion"] = suggestion
    except Exception as e:
        logger.warning(f"Planner parse error: {e}")
        state["planning_suggestion"] = {"day_of_week": 0, "meal_type": "lunch", "reason": ""}

    return state


# ─── Orchestrateur principal ─────────────────────────────────────────────────

async def run_pipeline(run_id: str, video_url: str, db):
    """
    Pipeline LangGraph-like :
    START → RecipeExtractor → NutritionCalculator → WeeklyPlanner → END
    (avec gestion d'erreurs et mise à jour du statut en base)
    """
    state = {
        "video_url": video_url,
        "video_id": None,
        "video_meta": {},
        "transcript": None,
        "extracted_recipe": None,
        "nutrition": None,
        "planning_suggestion": None,
        "errors": [],
        "messages": [],
    }

    try:
        # ── Agent 1 : RecipeExtractor
        await update_run(db, run_id, status="extracting", current_agent="RecipeExtractor", progress=10)
        state = await agent_recipe_extractor(state, run_id)

        if state["errors"]:
            raise ValueError(state["errors"][-1])

        # ── Agent 2 : NutritionCalculator
        await update_run(db, run_id, status="nutrition", current_agent="NutritionCalculator", progress=50)
        state = await agent_nutrition_calculator(state, run_id)

        # ── Agent 3 : WeeklyPlanner
        await update_run(db, run_id, status="planning", current_agent="WeeklyPlanner", progress=75)
        state = await agent_weekly_planner(state, db, run_id)

        # ── Sauvegarde en base
        await update_run(db, run_id, status="saving", current_agent="Sauvegarde", progress=90)
        recipe_id = await save_results(state, db)

        await update_run(db, run_id, status="completed", current_agent=None, progress=100, recipe_id=recipe_id)
        logger.info(f"Pipeline completed for run {run_id}, recipe_id={recipe_id}")

    except Exception as e:
        logger.error(f"Pipeline error for run {run_id}: {e}", exc_info=True)
        await update_run(db, run_id, status="error", error_message=str(e), progress=0)


async def save_results(state: dict, db) -> str:
    """Sauvegarde la vidéo et la recette en base, retourne recipe_id."""
    from bson import ObjectId

    video_id = state["video_id"]
    video_meta = state["video_meta"]
    recipe_data = state["extracted_recipe"]
    nutrition = state["nutrition"]
    planning = state.get("planning_suggestion")

    # Vidéo (idempotent)
    existing_video = await db.videos.find_one({"youtube_id": video_id})
    if existing_video:
        video_doc_id = str(existing_video["_id"])
    else:
        video_doc = {
            "youtube_id": video_id,
            "url": state["video_url"],
            "title": video_meta.get("title", ""),
            "channel": video_meta.get("channel", ""),
            "transcript": state.get("transcript", ""),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await db.videos.insert_one(video_doc)
        video_doc_id = str(result.inserted_id)

    # Recette
    recipe_doc = {
        "video_id": video_doc_id,
        "youtube_id": video_id,
        "video_title": video_meta.get("title", ""),
        "video_channel": video_meta.get("channel", ""),
        "title": recipe_data.get("title", "Recette sans titre"),
        "servings": recipe_data.get("servings", 4),
        "prep_time_minutes": recipe_data.get("prep_time_minutes"),
        "cook_time_minutes": recipe_data.get("cook_time_minutes"),
        "ingredients": recipe_data.get("ingredients", []),
        "steps": recipe_data.get("steps", []),
        "tags": recipe_data.get("tags", []),
        "nutrition": nutrition or {},
        "planning_suggestion": planning or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.recipes.insert_one(recipe_doc)
    return str(result.inserted_id)
