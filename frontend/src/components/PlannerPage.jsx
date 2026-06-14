import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, X, Flame, Search, Loader2, ShoppingCart } from "lucide-react";
import axios from "axios";
import ShoppingListModal from "@/components/ShoppingListModal";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MEALS = [
  { key: "breakfast", label: "Petit-dej." },
  { key: "lunch",     label: "Déjeuner" },
  { key: "dinner",    label: "Dîner" },
];

function getMonday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatWeek(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = d => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function dateToWeekKey(monday) {
  return monday.toISOString().split("T")[0];
}

function AddRecipeModal({ slot, onClose, onAdd }) {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = search ? { search } : {};
        const resp = await axios.get(`${API}/recipes`, { params });
        setRecipes(resp.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(fetch, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E0D8] shadow-xl w-full max-w-md animate-fade-up">
        <div className="p-5 border-b border-[#F3F1ED]">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-lg font-semibold text-[#2D2A26]">
              Ajouter une recette
            </h3>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[#F3F1ED] text-[#8A8782]">
              <X size={18} />
            </button>
          </div>
          <p className="text-xs text-[#8A8782]">
            {DAYS_FULL[slot.day]} — {MEALS.find(m => m.key === slot.meal)?.label}
          </p>
          {/* Search */}
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8782]" />
            <input
              type="text"
              data-testid="modal-recipe-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-3 py-2 rounded-full border border-[#E5E0D8] text-sm focus:outline-none focus:border-[#52796F] bg-[#FAF9F6]"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[#C84B31]" />
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-center py-6 text-sm text-[#8A8782]">Aucune recette trouvée</p>
          ) : (
            recipes.map(r => (
              <button
                key={r.id}
                data-testid={`modal-recipe-${r.id}`}
                onClick={() => onAdd(r)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F3F1ED] text-left transition-all"
              >
                <div className="w-10 h-10 bg-[#F3F1ED] rounded-xl flex-shrink-0 overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2D2A26] truncate">{r.title}</p>
                  <div className="flex items-center gap-2 text-xs text-[#8A8782] mt-0.5">
                    {r.nutrition?.calories > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Flame size={10} className="text-[#C84B31]" />
                        {r.nutrition.calories} kcal
                      </span>
                    )}
                    {(r.tags || []).slice(0, 2).map(t => (
                      <span key={t} className="bg-[#F3F1ED] px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SlotCell({ slot, recipeInSlot, onAdd, onRemove }) {
  if (recipeInSlot) {
    return (
      <div
        className="group relative bg-[#52796F]/10 border border-[#52796F]/20 rounded-xl p-2 h-full min-h-[64px] flex flex-col justify-between"
        data-testid={`plan-slot-filled-${slot.day}-${slot.meal}`}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold text-[#2D2A26] leading-tight line-clamp-2 flex-1">
            {recipeInSlot.recipe_title}
          </p>
          <button
            data-testid={`remove-slot-${recipeInSlot.id}`}
            onClick={(e) => { e.stopPropagation(); onRemove(recipeInSlot.id); }}
            className="flex-shrink-0 p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 text-[#8A8782] hover:text-red-500 transition-all"
          >
            <X size={12} />
          </button>
        </div>
        {recipeInSlot.recipe_calories > 0 && (
          <p className="text-xs text-[#52796F] mt-1 flex items-center gap-0.5">
            <Flame size={10} />
            {recipeInSlot.recipe_calories} kcal
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      data-testid={`plan-slot-empty-${slot.day}-${slot.meal}`}
      onClick={onAdd}
      className="w-full h-full min-h-[64px] flex items-center justify-center rounded-xl border border-dashed border-[#E5E0D8] hover:border-[#52796F] hover:bg-[#52796F]/5 text-[#E5E0D8] hover:text-[#52796F] transition-all group"
    >
      <Plus size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform" />
    </button>
  );
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const [monday, setMonday] = useState(getMonday());
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(null); // { day, meal }
  const [showShopping, setShowShopping] = useState(false);

  const weekKey = dateToWeekKey(monday);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API}/plans/${weekKey}`);
      setPlan(resp.data);
    } catch (e) {
      setPlan({ week_start: weekKey, slots: [] });
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const handleAddRecipe = async (recipe) => {
    if (!addModal) return;
    try {
      const resp = await axios.post(`${API}/plans/${weekKey}/slots`, {
        recipe_id: recipe.id,
        day_of_week: addModal.day,
        meal_type: addModal.meal,
      });
      setPlan(prev => ({
        ...prev,
        slots: [...(prev?.slots || []), resp.data],
      }));
    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur lors de l'ajout";
      alert(msg);
    }
    setAddModal(null);
  };

  const handleRemoveSlot = async (slotId) => {
    try {
      await axios.delete(`${API}/plans/${weekKey}/slots/${slotId}`);
      setPlan(prev => ({
        ...prev,
        slots: prev.slots.filter(s => s.id !== slotId),
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const prevWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  };

  const nextWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  };

  const getSlot = (day, meal) => plan?.slots?.find(s => s.day_of_week === day && s.meal_type === meal);

  // Calculate weekly nutrition summary
  const totalCalories = (plan?.slots || []).reduce((sum, s) => sum + (s.recipe_calories || 0), 0);
  const mealsPlanned = (plan?.slots || []).length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAF9F6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#52796F] mb-1">
              Planning hebdomadaire
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2D2A26]">
              Planificateur
            </h1>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-3">
            <button
              data-testid="prev-week-btn"
              onClick={prevWeek}
              className="p-2 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#F3F1ED] text-[#5C5955] transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-center px-3">
              <p className="text-sm font-semibold text-[#2D2A26]" data-testid="week-label">
                {formatWeek(monday)}
              </p>
              <p className="text-xs text-[#8A8782]">{mealsPlanned} repas planifiés</p>
            </div>
            <button
              data-testid="next-week-btn"
              onClick={nextWeek}
              className="p-2 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#F3F1ED] text-[#5C5955] transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {mealsPlanned > 0 && (
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-6 bg-white rounded-2xl border border-[#E5E0D8] px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Flame size={16} className="text-[#C84B31]" strokeWidth={1.5} />
                <span className="text-[#8A8782]">Total semaine :</span>
                <strong className="text-[#2D2A26]">{totalCalories.toLocaleString("fr")} kcal</strong>
              </div>
              <div className="text-sm text-[#8A8782]">
                {mealsPlanned}/21 repas
              </div>
            </div>
            <button
              data-testid="open-shopping-list-btn"
              onClick={() => setShowShopping(true)}
              className="flex items-center gap-2 bg-[#52796F] hover:bg-[#42635B] text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 shadow-sm"
            >
              <ShoppingCart size={16} strokeWidth={1.5} />
              Liste de courses
            </button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="text-[#C84B31] animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm overflow-hidden" data-testid="planner-grid">
            {/* Day headers */}
            <div className="grid grid-cols-8 border-b border-[#E5E0D8]">
              <div className="p-3 border-r border-[#E5E0D8]" />
              {DAYS.map((d, i) => {
                const dayDate = new Date(monday);
                dayDate.setDate(monday.getDate() + i);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                return (
                  <div key={i} className={`p-3 text-center border-r border-[#E5E0D8] last:border-r-0 ${isToday ? "bg-[#C84B31]/5" : ""}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? "text-[#C84B31]" : "text-[#5C5955]"}`}>
                      {d}
                    </p>
                    <p className={`text-sm font-semibold mt-0.5 ${isToday ? "text-[#C84B31]" : "text-[#2D2A26]"}`}>
                      {dayDate.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Rows per meal */}
            {MEALS.map((meal, mi) => (
              <div key={meal.key} className={`grid grid-cols-8 ${mi < MEALS.length - 1 ? "border-b border-[#E5E0D8]" : ""}`}>
                {/* Meal label */}
                <div className="p-3 border-r border-[#E5E0D8] flex items-center justify-center bg-[#FAF9F6]">
                  <p className="text-xs font-semibold text-[#5C5955] text-center writing-mode-vertical">
                    {meal.label}
                  </p>
                </div>
                {/* Day slots */}
                {DAYS.map((_, day) => {
                  const slotData = getSlot(day, meal.key);
                  return (
                    <div key={day} className="p-1.5 border-r border-[#F3F1ED] last:border-r-0 min-h-[80px]">
                      <SlotCell
                        slot={{ day, meal: meal.key }}
                        recipeInSlot={slotData}
                        onAdd={() => setAddModal({ day, meal: meal.key })}
                        onRemove={handleRemoveSlot}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && mealsPlanned === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-[#8A8782] mb-3">Aucun repas planifié cette semaine</p>
            <button
              data-testid="go-to-recipes-btn"
              onClick={() => navigate("/recipes")}
              className="text-sm text-[#52796F] hover:text-[#42635B] font-semibold transition-colors"
            >
              Voir mes recettes →
            </button>
          </div>
        )}
      </div>

      {addModal && (
        <AddRecipeModal
          slot={addModal}
          onClose={() => setAddModal(null)}
          onAdd={handleAddRecipe}
        />
      )}

      {showShopping && (
        <ShoppingListModal
          weekKey={weekKey}
          weekLabel={formatWeek(monday)}
          onClose={() => setShowShopping(false)}
        />
      )}
    </div>
  );
}
