import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, ChefHat, CheckCircle2, Circle, Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AGENTS = [
  { key: "extracting", label: "Extraction de la recette", desc: "L'IA analyse la transcription YouTube", icon: "🎬" },
  { key: "nutrition",  label: "Calcul nutritionnel",      desc: "Estimation des macros et calories",    icon: "🥗" },
  { key: "planning",   label: "Planification",            desc: "Suggestion de placement hebdomadaire", icon: "📅" },
  { key: "saving",     label: "Sauvegarde",               desc: "Enregistrement en base de données",    icon: "💾" },
];

const STATUS_ORDER = ["extracting", "nutrition", "planning", "saving", "completed"];

function AgentStep({ step, status, isActive }) {
  const idx = STATUS_ORDER.indexOf(status);
  const stepIdx = STATUS_ORDER.indexOf(step.key);
  const done = idx > stepIdx || status === "completed";
  const active = step.key === status || (status === "completed" && step.key === "saving");

  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl transition-all duration-300 ${active ? "bg-[#52796F]/10 border border-[#52796F]/20" : done ? "opacity-70" : "opacity-40"}`}>
      <div className="relative flex-shrink-0 mt-0.5">
        {done ? (
          <CheckCircle2 size={22} className="text-[#52796F]" />
        ) : active ? (
          <div className="relative">
            <Loader2 size={22} className="text-[#C84B31] animate-spin" />
          </div>
        ) : (
          <Circle size={22} className="text-[#E5E0D8]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base">{step.icon}</span>
          <p className={`text-sm font-semibold ${done ? "text-[#52796F]" : active ? "text-[#2D2A26]" : "text-[#8A8782]"}`}>
            {step.label}
          </p>
        </div>
        <p className="text-xs text-[#8A8782] mt-0.5">{step.desc}</p>
      </div>
    </div>
  );
}

function RecipePreviewCard({ recipe, onView }) {
  return (
    <div className="animate-fade-up bg-white rounded-3xl border border-[#E5E0D8] p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-[#52796F] mb-1">Recette extraite</p>
          <h3 className="font-display text-xl font-semibold text-[#2D2A26] mb-2">{recipe.title}</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {(recipe.tags || []).slice(0, 4).map(tag => (
              <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F1ED] text-[#5C5955]">
                {tag}
              </span>
            ))}
          </div>
          <div className="flex gap-4 text-sm text-[#5C5955]">
            {recipe.nutrition?.calories > 0 && (
              <span><strong className="text-[#2D2A26]">{recipe.nutrition.calories}</strong> kcal</span>
            )}
            {recipe.servings > 0 && (
              <span><strong className="text-[#2D2A26]">{recipe.servings}</strong> portions</span>
            )}
            {recipe.prep_time_minutes > 0 && (
              <span><strong className="text-[#2D2A26]">{recipe.prep_time_minutes}</strong> min prep</span>
            )}
          </div>
        </div>
        <div className="w-16 h-16 bg-[#F3F1ED] rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl">
          🍽️
        </div>
      </div>
      {recipe.planning_suggestion?.reason && (
        <div className="mt-4 p-3 bg-[#52796F]/8 rounded-xl border border-[#52796F]/15">
          <p className="text-xs text-[#52796F] font-medium">
            <span className="font-bold">Suggestion :</span> {recipe.planning_suggestion.reason}
          </p>
        </div>
      )}
      <button
        data-testid="view-recipe-btn"
        onClick={() => onView(recipe.id)}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-[#C84B31] hover:bg-[#A83F29] text-white rounded-full py-2.5 text-sm font-semibold transition-all active:scale-95"
      >
        Voir la recette complète
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

export default function IngestPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [runId, setRunId] = useState(null);
  const [run, setRun] = useState(null);
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchRecipe = useCallback(async (recipeId) => {
    try {
      const resp = await axios.get(`${API}/recipes/${recipeId}`);
      setRecipe(resp.data);
    } catch (e) {
      console.error("Failed to fetch recipe", e);
    }
  }, []);

  useEffect(() => {
    if (!runId) return;

    intervalRef.current = setInterval(async () => {
      try {
        const resp = await axios.get(`${API}/runs/${runId}`);
        setRun(resp.data);

        if (resp.data.status === "completed") {
          stopPolling();
          if (resp.data.recipe_id) {
            await fetchRecipe(resp.data.recipe_id);
          }
        } else if (resp.data.status === "error") {
          stopPolling();
          setError(resp.data.error_message || "Erreur lors de l'extraction");
          setLoading(false);
        }
      } catch (e) {
        stopPolling();
        setError("Impossible de contacter le serveur");
        setLoading(false);
      }
    }, 2000);

    return stopPolling;
  }, [runId, stopPolling, fetchRecipe]);

  const handleIngest = async (e) => {
    e.preventDefault();
    setError("");
    setRun(null);
    setRecipe(null);
    setRunId(null);

    if (!url.trim()) {
      setError("Veuillez entrer une URL YouTube");
      return;
    }

    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\n?#]+)/;
    if (!youtubeRegex.test(url.trim())) {
      setError("URL YouTube invalide. Exemple : https://www.youtube.com/watch?v=...");
      return;
    }

    setLoading(true);
    try {
      const resp = await axios.post(`${API}/videos/ingest`, { url: url.trim() });
      if (resp.data.already_exists && resp.data.recipe_id) {
        await fetchRecipe(resp.data.recipe_id);
        setLoading(false);
        return;
      }
      setRunId(resp.data.run_id);
    } catch (e) {
      const msg = e.response?.data?.detail || "Erreur lors du lancement";
      setError(msg);
      setLoading(false);
    }
  };

  const reset = () => {
    stopPolling();
    setUrl("");
    setRun(null);
    setRecipe(null);
    setRunId(null);
    setError("");
    setLoading(false);
  };

  const isProcessing = loading && !recipe && !error;
  const isCompleted = run?.status === "completed" || recipe;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAF9F6]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{ backgroundImage: "url(https://static.prod-images.emergentagent.com/jobs/1d7de576-1d6b-46bf-b5e5-319b272feee7/images/40cee2da9ab8aac23e8508a2c38991ee8a08de701f91fab475a2e81278bfb65c.png)" }}
        />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-[#52796F]/10 text-[#52796F] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
            <Sparkles size={12} />
            Propulsé par l'IA
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#2D2A26] mb-4 leading-tight">
            Transformez vos vidéos<br />
            <span className="text-[#C84B31]">YouTube</span> en recettes
          </h1>
          <p className="text-base sm:text-lg text-[#5C5955] max-w-xl mx-auto leading-relaxed">
            Collez l'URL d'une vidéo de cuisine et notre pipeline IA extrait la recette, calcule les macros et planifie votre semaine.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16">
        <form
          onSubmit={handleIngest}
          className="bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6 sm:p-8"
        >
          <label className="block text-sm font-semibold text-[#2D2A26] mb-2">
            URL de la vidéo YouTube
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8782]" strokeWidth={1.5} />
              <input
                type="text"
                data-testid="youtube-url-input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={isProcessing}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-[#E5E0D8] bg-[#FAF9F6] text-[#2D2A26] placeholder-[#8A8782] focus:outline-none focus:ring-2 focus:ring-[#52796F]/30 focus:border-[#52796F] transition-all text-sm disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              data-testid="extract-recipe-btn"
              disabled={isProcessing || !url.trim()}
              className="flex items-center gap-2 bg-[#C84B31] hover:bg-[#A83F29] disabled:bg-[#E5E0D8] disabled:text-[#8A8782] text-white rounded-full px-6 py-3 text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
            >
              {isProcessing ? (
                <><Loader2 size={16} className="animate-spin" />En cours...</>
              ) : (
                <><ChefHat size={16} />Extraire</>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3" data-testid="error-message">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </form>

        {/* Pipeline Progress */}
        {isProcessing && run && (
          <div className="mt-6 bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-6 animate-fade-up" data-testid="pipeline-progress">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-[#2D2A26]">Pipeline en cours</h3>
              <span className="text-sm font-bold text-[#C84B31]">{run.progress || 0}%</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-[#F3F1ED] rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#52796F] to-[#C84B31] rounded-full transition-all duration-500"
                style={{ width: `${run.progress || 0}%` }}
              />
            </div>
            {/* Steps */}
            <div className="space-y-2">
              {AGENTS.map(step => (
                <AgentStep
                  key={step.key}
                  step={step}
                  status={run.status}
                  isActive={run.status === step.key}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading initial (avant 1ère réponse polling) */}
        {isProcessing && !run && (
          <div className="mt-6 bg-white rounded-3xl border border-[#E5E0D8] p-8 flex flex-col items-center gap-4 animate-fade-up">
            <img
              src="https://static.prod-images.emergentagent.com/jobs/1d7de576-1d6b-46bf-b5e5-319b272feee7/images/ac1585a3d09372ffc172a205f4a402a78d12769b6c9571cfba40068bc6902306.png"
              alt="IA en action"
              className="w-24 h-24 object-contain opacity-70"
            />
            <div className="text-center">
              <p className="font-semibold text-[#2D2A26]">Démarrage du pipeline…</p>
              <p className="text-sm text-[#8A8782] mt-1">Connexion aux agents IA</p>
            </div>
          </div>
        )}

        {/* Recipe Preview */}
        {recipe && (
          <div className="mt-6">
            <RecipePreviewCard recipe={recipe} onView={id => navigate(`/recipes/${id}`)} />
            <button
              data-testid="extract-another-btn"
              onClick={reset}
              className="mt-4 w-full text-center text-sm text-[#8A8782] hover:text-[#5C5955] transition-colors py-2"
            >
              + Extraire une autre recette
            </button>
          </div>
        )}

        {/* How it works */}
        {!isProcessing && !recipe && (
          <div className="mt-10">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-[#52796F] mb-6">
              Comment ça marche
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: "🎬", title: "Collez l'URL", desc: "N'importe quelle vidéo de cuisine YouTube" },
                { icon: "🤖", title: "IA analyse", desc: "3 agents extraient, calculent et planifient" },
                { icon: "📋", title: "Recette prête", desc: "Structurée, enrichie et planifiable" },
              ].map((step, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-[#E5E0D8] p-4 text-center"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-2xl mb-2">{step.icon}</div>
                  <p className="text-sm font-semibold text-[#2D2A26] mb-1">{step.title}</p>
                  <p className="text-xs text-[#8A8782]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
