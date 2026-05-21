import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Clock, Users, Flame, Leaf, CalendarDays,
  ChefHat, CheckCircle, Circle, Youtube, Loader2
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MEALS = [
  { key: "breakfast", label: "Petit-déjeuner" },
  { key: "lunch",     label: "Déjeuner" },
  { key: "dinner",    label: "Dîner" },
];

const MACRO_COLORS = {
  Protéines: "#52796F",
  Glucides:  "#C84B31",
  Lipides:   "#E07A5F",
  Fibres:    "#A8C5A0",
};

function NutritionRing({ nutrition }) {
  if (!nutrition || nutrition.calories === 0) return null;

  const data = [
    { name: "Protéines", value: Math.round(nutrition.protein_g || 0) },
    { name: "Glucides",  value: Math.round(nutrition.carbs_g || 0) },
    { name: "Lipides",   value: Math.round(nutrition.fat_g || 0) },
    { name: "Fibres",    value: Math.round(nutrition.fiber_g || 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-[#F3F1ED] rounded-2xl p-6 border border-[#E5E0D8]/50">
      <h3 className="font-display text-lg font-semibold text-[#2D2A26] mb-4">Valeurs nutritionnelles</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={MACRO_COLORS[entry.name]} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}g`, name]}
                contentStyle={{ borderRadius: "12px", border: "1px solid #E5E0D8", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center calories */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-[#2D2A26] font-body">{Math.round(nutrition.calories)}</span>
            <span className="text-xs text-[#8A8782]">kcal</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: MACRO_COLORS[d.name] }} />
              <div>
                <p className="text-xs text-[#8A8782]">{d.name}</p>
                <p className="text-sm font-semibold text-[#2D2A26]">{d.value}g</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {nutrition.source === "estimation_llm" && (
        <p className="mt-3 text-xs text-[#8A8782] italic">* Valeurs estimées par IA</p>
      )}
    </div>
  );
}

function AddToPlannerModal({ recipe, onClose, onAdded }) {
  const [day, setDay] = useState(0);
  const [meal, setMeal] = useState("lunch");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API}/plans/current/slots`, {
        recipe_id: recipe.id,
        day_of_week: day,
        meal_type: meal,
      });
      onAdded();
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-xl p-6 w-full max-w-sm animate-fade-up">
        <h3 className="font-display text-lg font-semibold text-[#2D2A26] mb-1">Ajouter au planning</h3>
        <p className="text-sm text-[#8A8782] mb-5 truncate">{recipe.title}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#5C5955] uppercase tracking-wide block mb-2">Jour</label>
            <div className="grid grid-cols-4 gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={i}
                  data-testid={`day-btn-${i}`}
                  onClick={() => setDay(i)}
                  className={`py-1.5 rounded-xl text-xs font-medium transition-all ${day === i ? "bg-[#52796F] text-white" : "bg-[#F3F1ED] text-[#5C5955] hover:bg-[#E5E0D8]"}`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#5C5955] uppercase tracking-wide block mb-2">Repas</label>
            <div className="grid grid-cols-3 gap-2">
              {MEALS.map(m => (
                <button
                  key={m.key}
                  data-testid={`meal-btn-${m.key}`}
                  onClick={() => setMeal(m.key)}
                  className={`py-2 rounded-xl text-xs font-medium transition-all ${meal === m.key ? "bg-[#C84B31] text-white" : "bg-[#F3F1ED] text-[#5C5955] hover:bg-[#E5E0D8]"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            data-testid="add-to-plan-confirm-btn"
            onClick={handleAdd}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#C84B31] hover:bg-[#A83F29] text-white rounded-full py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
            Ajouter
          </button>
          <button
            data-testid="add-to-plan-cancel-btn"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#F3F1ED] hover:bg-[#E5E0D8] text-[#5C5955] rounded-full text-sm font-semibold transition-all"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [showPlanModal, setShowPlanModal] = useState(false);

  useEffect(() => {
    axios.get(`${API}/recipes/${id}`)
      .then(r => setRecipe(r.data))
      .catch(() => navigate("/recipes"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const toggleStep = (i) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 size={32} className="text-[#C84B31] animate-spin" />
      </div>
    );
  }

  if (!recipe) return null;

  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAF9F6]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <button
          data-testid="back-to-recipes-btn"
          onClick={() => navigate("/recipes")}
          className="flex items-center gap-2 text-sm text-[#5C5955] hover:text-[#2D2A26] mb-6 group transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={1.5} className="group-hover:-translate-x-1 transition-transform" />
          Retour aux recettes
        </button>

        {/* Header */}
        <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6 sm:p-8 mb-6 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              {/* Tags */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(recipe.tags || []).map(tag => (
                  <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F1ED] text-[#5C5955]">
                    {tag}
                  </span>
                ))}
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2D2A26] leading-tight mb-4">
                {recipe.title}
              </h1>

              {/* Stats row */}
              <div className="flex flex-wrap gap-4">
                {recipe.nutrition?.calories > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#5C5955]">
                    <Flame size={16} strokeWidth={1.5} className="text-[#C84B31]" />
                    <strong className="text-[#2D2A26]">{Math.round(recipe.nutrition.calories)}</strong> kcal
                  </div>
                )}
                {recipe.servings > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#5C5955]">
                    <Users size={16} strokeWidth={1.5} />
                    <strong className="text-[#2D2A26]">{recipe.servings}</strong> portions
                  </div>
                )}
                {recipe.prep_time_minutes > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#5C5955]">
                    <Clock size={16} strokeWidth={1.5} />
                    Prep <strong className="text-[#2D2A26] ml-1">{recipe.prep_time_minutes}</strong> min
                  </div>
                )}
                {recipe.cook_time_minutes > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-[#5C5955]">
                    <ChefHat size={16} strokeWidth={1.5} />
                    Cuisson <strong className="text-[#2D2A26] ml-1">{recipe.cook_time_minutes}</strong> min
                  </div>
                )}
              </div>

              {/* Source YouTube */}
              {recipe.video_title && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#8A8782]">
                  <Youtube size={14} className="text-red-500" />
                  <span className="truncate">{recipe.video_title}</span>
                  {recipe.video_channel && (
                    <span className="text-[#C84B31]">— {recipe.video_channel}</span>
                  )}
                </div>
              )}
            </div>

            {/* Add to planner btn */}
            <button
              data-testid="add-to-planner-btn"
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 bg-[#52796F] hover:bg-[#42635B] text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
            >
              <CalendarDays size={16} />
              Planifier
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Ingredients */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <h2 className="font-display text-xl font-semibold text-[#2D2A26] mb-4 flex items-center gap-2">
                <Leaf size={18} strokeWidth={1.5} className="text-[#52796F]" />
                Ingrédients
              </h2>
              <p className="text-xs text-[#8A8782] mb-4">{recipe.servings} portion{recipe.servings !== 1 ? "s" : ""}</p>
              <ul className="space-y-2.5" data-testid="ingredients-list">
                {(recipe.ingredients || []).map((ing, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C84B31] flex-shrink-0 mt-2" />
                    <span className="text-[#5C5955]">
                      {ing.quantity && <strong className="text-[#2D2A26]">{ing.quantity} {ing.unit} </strong>}
                      {ing.name}
                      {ing.notes && <span className="text-[#8A8782] italic"> ({ing.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutrition */}
            <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
              <NutritionRing nutrition={recipe.nutrition} />
            </div>

            {/* Planning suggestion */}
            {recipe.planning_suggestion?.reason && (
              <div className="bg-[#52796F]/8 rounded-2xl border border-[#52796F]/20 p-5 animate-fade-up" style={{ animationDelay: "300ms" }}>
                <p className="text-xs font-bold uppercase tracking-widest text-[#52796F] mb-2">Suggestion IA</p>
                <p className="text-sm text-[#5C5955]">
                  <strong className="text-[#2D2A26]">
                    {DAYS[recipe.planning_suggestion.day_of_week || 0]} —{" "}
                    {MEALS.find(m => m.key === recipe.planning_suggestion.meal_type)?.label}
                  </strong>
                  <br />
                  {recipe.planning_suggestion.reason}
                </p>
              </div>
            )}
          </div>

          {/* Right: Steps */}
          <div className="lg:col-span-3 animate-fade-up" style={{ animationDelay: "150ms" }}>
            <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6">
              <h2 className="font-display text-xl font-semibold text-[#2D2A26] mb-6">
                Instructions
              </h2>
              <div className="space-y-4" data-testid="steps-list">
                {(recipe.steps || []).map((step, i) => {
                  const done = completedSteps.has(i);
                  return (
                    <button
                      key={i}
                      data-testid={`step-${i}`}
                      onClick={() => toggleStep(i)}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl text-left transition-all ${done ? "bg-[#52796F]/8 opacity-60" : "hover:bg-[#FAF9F6]"}`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {done ? (
                          <CheckCircle size={22} className="text-[#52796F]" strokeWidth={1.5} />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-[#C84B31] flex items-center justify-center text-xs font-bold text-[#C84B31]">
                            {i + 1}
                          </div>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${done ? "line-through text-[#8A8782]" : "text-[#5C5955]"}`}>
                        {step}
                      </p>
                    </button>
                  );
                })}
              </div>
              {completedSteps.size === (recipe.steps || []).length && recipe.steps?.length > 0 && (
                <div className="mt-6 p-4 bg-[#52796F]/10 rounded-2xl text-center">
                  <p className="font-display text-lg text-[#52796F]">Bon appétit !</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPlanModal && (
        <AddToPlannerModal
          recipe={recipe}
          onClose={() => setShowPlanModal(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  );
}
