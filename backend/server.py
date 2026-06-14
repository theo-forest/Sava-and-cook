"""
Save & Cook — FastAPI Backend
"""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Annotated

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ─── DB ─────────────────────────────────────────────────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Save & Cook API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ─── Helpers MongoDB ─────────────────────────────────────────────────────────
PyObjectId = Annotated[str, BeforeValidator(str)]


def doc_to_dict(doc: dict) -> dict:
    """Convertit _id ObjectId → id str."""
    if doc is None:
        return {}
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d


# ─── Models ─────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    url: str


class AddSlotRequest(BaseModel):
    recipe_id: str
    day_of_week: int   # 0=Lundi … 6=Dimanche
    meal_type: str     # breakfast | lunch | dinner


# ─── Routes ─────────────────────────────────────────────────────────────────

@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── Ingestion ──────────────────────────────────────────────────────────────

@api_router.post("/videos/ingest")
async def ingest_video(req: IngestRequest, background_tasks: BackgroundTasks):
    from agents import run_pipeline, extract_video_id

    url = req.url.strip()
    if not url:
        raise HTTPException(400, detail="URL manquante")

    video_id = extract_video_id(url)
    if not video_id:
        raise HTTPException(400, detail="URL YouTube invalide")

    # Vérifie si la recette existe déjà
    existing_recipe = await db.recipes.find_one({"youtube_id": video_id})
    if existing_recipe:
        return {
            "run_id": None,
            "recipe_id": str(existing_recipe["_id"]),
            "message": "Recette déjà extraite",
            "already_exists": True,
        }

    run_id = str(uuid.uuid4())
    run_doc = {
        "run_id": run_id,
        "video_url": url,
        "status": "pending",
        "current_agent": None,
        "progress": 0,
        "recipe_id": None,
        "error_message": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.processing_runs.insert_one(run_doc)
    background_tasks.add_task(run_pipeline, run_id, url, db)

    return {"run_id": run_id, "message": "Pipeline démarré", "already_exists": False}


@api_router.get("/runs/{run_id}")
async def get_run(run_id: str):
    doc = await db.processing_runs.find_one({"run_id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, detail="Run introuvable")
    return doc


# ── Recettes ───────────────────────────────────────────────────────────────

@api_router.get("/recipes")
async def list_recipes(tag: Optional[str] = None, search: Optional[str] = None, limit: int = 50):
    query = {}
    if tag:
        query["tags"] = {"$in": [tag]}
    if search:
        query["title"] = {"$regex": search, "$options": "i"}

    cursor = db.recipes.find(query, {"transcript": 0}).sort("created_at", -1).limit(limit)
    recipes = await cursor.to_list(limit)
    return [doc_to_dict(r) for r in recipes]


@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str):
    try:
        oid = ObjectId(recipe_id)
    except Exception:
        raise HTTPException(400, detail="ID invalide")

    doc = await db.recipes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Recette introuvable")
    return doc_to_dict(doc)


@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str):
    try:
        oid = ObjectId(recipe_id)
    except Exception:
        raise HTTPException(400, detail="ID invalide")

    result = await db.recipes.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, detail="Recette introuvable")

    # Supprime aussi les slots du plan
    await db.weekly_plans.update_many({}, {"$pull": {"slots": {"recipe_id": recipe_id}}})
    return {"message": "Recette supprimée"}


# ── Plans hebdomadaires ────────────────────────────────────────────────────

def _current_week_start() -> str:
    today = datetime.now(timezone.utc)
    monday = today - timedelta(days=today.weekday())
    return monday.strftime("%Y-%m-%d")


@api_router.get("/plans/{week}")
async def get_plan(week: str):
    """week = 'current' ou 'YYYY-MM-DD' (lundi de la semaine)."""
    if week == "current":
        week = _current_week_start()

    plan = await db.weekly_plans.find_one({"week_start": week})
    if not plan:
        return {"week_start": week, "slots": []}
    return doc_to_dict(plan)


@api_router.post("/plans/{week}/slots")
async def add_slot(week: str, req: AddSlotRequest):
    if week == "current":
        week = _current_week_start()

    # Récupère la recette
    try:
        oid = ObjectId(req.recipe_id)
    except Exception:
        raise HTTPException(400, detail="recipe_id invalide")

    recipe = await db.recipes.find_one({"_id": oid})
    if not recipe:
        raise HTTPException(404, detail="Recette introuvable")

    # Vérifie si le slot est déjà occupé
    plan = await db.weekly_plans.find_one({"week_start": week})
    if plan:
        for slot in plan.get("slots", []):
            if slot["day_of_week"] == req.day_of_week and slot["meal_type"] == req.meal_type:
                raise HTTPException(409, detail="Ce créneau est déjà occupé")

    slot_doc = {
        "id": str(uuid.uuid4()),
        "recipe_id": req.recipe_id,
        "recipe_title": recipe.get("title", ""),
        "recipe_calories": recipe.get("nutrition", {}).get("calories", 0),
        "recipe_tags": recipe.get("tags", []),
        "day_of_week": req.day_of_week,
        "meal_type": req.meal_type,
    }

    await db.weekly_plans.update_one(
        {"week_start": week},
        {
            "$push": {"slots": slot_doc},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            "$setOnInsert": {"week_start": week, "created_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    return slot_doc


@api_router.delete("/plans/{week}/slots/{slot_id}")
async def remove_slot(week: str, slot_id: str):
    if week == "current":
        week = _current_week_start()

    result = await db.weekly_plans.update_one(
        {"week_start": week},
        {"$pull": {"slots": {"id": slot_id}}},
    )
    if result.modified_count == 0:
        raise HTTPException(404, detail="Slot introuvable")
    return {"message": "Slot supprimé"}


# ── Liste de courses ───────────────────────────────────────────────────────

@api_router.get("/plans/{week}/shopping-list")
async def get_shopping_list(week: str):
    """Agrège tous les ingrédients des recettes planifiées pour la semaine."""
    if week == "current":
        week = _current_week_start()

    plan = await db.weekly_plans.find_one({"week_start": week})
    if not plan or not plan.get("slots"):
        return {"week_start": week, "meals": [], "total_ingredients": 0, "total_calories": 0}

    DAYS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    MEALS_FR = {"breakfast": "Petit-déjeuner", "lunch": "Déjeuner", "dinner": "Dîner"}
    MEAL_ORDER = {"breakfast": 0, "lunch": 1, "dinner": 2}

    # Fetch recipes for each slot (deduplicate by recipe_id)
    recipe_cache = {}
    async def get_recipe(recipe_id: str):
        if recipe_id in recipe_cache:
            return recipe_cache[recipe_id]
        try:
            doc = await db.recipes.find_one({"_id": ObjectId(recipe_id)})
            recipe_cache[recipe_id] = doc
            return doc
        except Exception:
            return None

    # Sort slots by day then meal
    sorted_slots = sorted(
        plan["slots"],
        key=lambda s: (s["day_of_week"], MEAL_ORDER.get(s["meal_type"], 9))
    )

    meals = []
    total_calories = 0
    for slot in sorted_slots:
        recipe = await get_recipe(slot["recipe_id"])
        if not recipe:
            continue

        ingredients = recipe.get("ingredients", [])
        calories = recipe.get("nutrition", {}).get("calories", 0)
        total_calories += calories or 0

        meals.append({
            "day_label": DAYS_FR[slot["day_of_week"]],
            "meal_label": MEALS_FR.get(slot["meal_type"], slot["meal_type"]),
            "recipe_title": recipe.get("title", ""),
            "servings": recipe.get("servings", 4),
            "calories": calories,
            "ingredients": ingredients,
        })

    return {
        "week_start": week,
        "meals": meals,
        "total_meals": len(meals),
        "total_ingredients": sum(len(m["ingredients"]) for m in meals),
        "total_calories": round(total_calories),
    }


# ── Stats ─────────────────────────────────────────────────────────────────

@api_router.get("/stats")
async def get_stats():
    total_recipes = await db.recipes.count_documents({})
    total_videos = await db.videos.count_documents({})
    # Semaine en cours
    week = _current_week_start()
    plan = await db.weekly_plans.find_one({"week_start": week})
    planned_meals = len(plan.get("slots", [])) if plan else 0
    return {
        "total_recipes": total_recipes,
        "total_videos": total_videos,
        "planned_meals_this_week": planned_meals,
    }


# ─── Mount ───────────────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
