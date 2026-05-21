"""Backend API tests for Save & Cook app"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestHealth:
    def test_health_returns_ok(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"

class TestStats:
    def test_stats_returns_counts(self):
        r = requests.get(f"{BASE_URL}/api/stats")
        assert r.status_code == 200
        data = r.json()
        assert "total_recipes" in data
        assert "planned_meals_this_week" in data

class TestRecipes:
    def test_list_recipes_empty(self):
        r = requests.get(f"{BASE_URL}/api/recipes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

class TestIngest:
    def test_ingest_invalid_url_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/videos/ingest", json={"url": "not-a-url"})
        assert r.status_code == 400

    def test_ingest_empty_url_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/videos/ingest", json={"url": ""})
        assert r.status_code == 400

class TestPlans:
    def test_get_current_plan(self):
        r = requests.get(f"{BASE_URL}/api/plans/current")
        assert r.status_code == 200
        data = r.json()
        assert "week_start" in data
        assert "slots" in data
        assert isinstance(data["slots"], list)

    def test_add_slot_invalid_recipe_id_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/plans/current/slots", json={
            "recipe_id": "invalid-id",
            "day_of_week": 0,
            "meal_type": "lunch"
        })
        assert r.status_code == 400
