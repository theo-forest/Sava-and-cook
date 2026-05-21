import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock, Flame, Users, Trash2, Filter, BookOpen } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RECIPE_IMAGES = [
  "https://images.unsplash.com/photo-1764480527054-db33eaf227d6?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85&w=400",
  "https://images.pexels.com/photos/10506640/pexels-photo-10506640.jpeg?auto=compress&cs=tinysrgb&w=400",
  "https://images.pexels.com/photos/8366621/pexels-photo-8366621.jpeg?auto=compress&cs=tinysrgb&w=400",
  "https://images.pexels.com/photos/4552045/pexels-photo-4552045.jpeg?auto=compress&cs=tinysrgb&w=400",
];

const getRecipeImage = (title = "") => {
  const hash = title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return RECIPE_IMAGES[hash % RECIPE_IMAGES.length];
};

const ALL_TAGS = ["végétarien", "vegan", "sans-gluten", "rapide", "dessert", "healthy", "entrée", "plat-principal"];

function RecipeCard({ recipe, onDelete, onView }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="group bg-white rounded-3xl border border-[#E5E0D8] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer"
      data-testid={`recipe-card-${recipe.id}`}
      onClick={() => onView(recipe.id)}
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-[#F3F1ED]">
        <img
          src={getRecipeImage(recipe.title)}
          alt={recipe.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.src = RECIPE_IMAGES[0]; }}
        />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {/* Delete button */}
        <button
          data-testid={`delete-recipe-${recipe.id}`}
          onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-red-50 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-5">
        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(recipe.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F1ED] text-[#5C5955]">
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-[#2D2A26] text-base leading-tight mb-3 line-clamp-2">
          {recipe.title}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-[#8A8782]">
          {recipe.nutrition?.calories > 0 && (
            <span className="flex items-center gap-1">
              <Flame size={12} strokeWidth={1.5} className="text-[#C84B31]" />
              {recipe.nutrition.calories} kcal
            </span>
          )}
          {recipe.prep_time_minutes > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={12} strokeWidth={1.5} />
              {recipe.prep_time_minutes} min
            </span>
          )}
          {recipe.servings > 0 && (
            <span className="flex items-center gap-1">
              <Users size={12} strokeWidth={1.5} />
              {recipe.servings} pers.
            </span>
          )}
        </div>

        {/* Video source */}
        {recipe.video_title && (
          <p className="mt-3 text-xs text-[#8A8782] truncate border-t border-[#F3F1ED] pt-3">
            Source : {recipe.video_title}
          </p>
        )}
      </div>

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div
          className="absolute inset-0 bg-white/95 backdrop-blur rounded-3xl flex flex-col items-center justify-center p-6 z-10"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-[#2D2A26] mb-1 text-center">Supprimer cette recette ?</p>
          <p className="text-xs text-[#8A8782] mb-4 text-center">Cette action est irréversible</p>
          <div className="flex gap-3">
            <button
              data-testid="confirm-delete-btn"
              onClick={() => { onDelete(recipe.id); setConfirmDelete(false); }}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-semibold transition-all"
            >
              Supprimer
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 bg-[#F3F1ED] hover:bg-[#E5E0D8] text-[#5C5955] rounded-full text-xs font-semibold transition-all"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecipesPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (activeTag) params.tag = activeTag;
      const resp = await axios.get(`${API}/recipes`, { params });
      setRecipes(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [search, activeTag]);

  const handleDelete = async (id) => {
    await axios.delete(`${API}/recipes/${id}`);
    setRecipes(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAF9F6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#52796F] mb-1">
            Bibliothèque
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#2D2A26]">
            Mes Recettes
          </h1>
          <p className="text-[#8A8782] mt-1">
            {recipes.length} recette{recipes.length !== 1 ? "s" : ""} extraite{recipes.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A8782]" />
            <input
              type="text"
              data-testid="recipe-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une recette..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#E5E0D8] bg-white text-sm text-[#2D2A26] placeholder-[#8A8782] focus:outline-none focus:ring-2 focus:ring-[#52796F]/30 focus:border-[#52796F] transition-all"
            />
          </div>

          {/* Tag Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
            <Filter size={14} className="text-[#8A8782] flex-shrink-0" strokeWidth={1.5} />
            <button
              data-testid="filter-tag-all"
              onClick={() => setActiveTag("")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${!activeTag ? "bg-[#52796F] text-white" : "bg-white border border-[#E5E0D8] text-[#5C5955] hover:bg-[#F3F1ED]"}`}
            >
              Tous
            </button>
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                data-testid={`filter-tag-${tag}`}
                onClick={() => setActiveTag(tag === activeTag ? "" : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTag === tag ? "bg-[#52796F] text-white" : "bg-white border border-[#E5E0D8] text-[#5C5955] hover:bg-[#F3F1ED]"}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl border border-[#E5E0D8] overflow-hidden">
                <div className="h-44 skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-3 skeleton rounded-full w-2/3" />
                  <div className="h-4 skeleton rounded-full" />
                  <div className="h-3 skeleton rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen size={48} strokeWidth={1} className="text-[#E5E0D8] mx-auto mb-4" />
            <h3 className="font-display text-xl text-[#2D2A26] mb-2">Aucune recette trouvée</h3>
            <p className="text-sm text-[#8A8782] mb-6">
              {search || activeTag ? "Modifiez vos filtres" : "Commencez par extraire une recette depuis YouTube"}
            </p>
            <button
              data-testid="empty-ingest-btn"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 bg-[#C84B31] text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-[#A83F29] transition-all"
            >
              Extraire une recette
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe, i) => (
              <div key={recipe.id} className="relative animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                <RecipeCard
                  recipe={recipe}
                  onDelete={handleDelete}
                  onView={id => navigate(`/recipes/${id}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
