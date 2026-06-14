import { useState, useEffect, useRef } from "react";
import { X, Download, ShoppingCart, Check, Loader2, ChefHat, Flame, Package } from "lucide-react";
import axios from "axios";
import jsPDF from "jspdf";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── PDF Generator ────────────────────────────────────────────────────────────
function buildPDF(data, weekLabel) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  const colW = pageW - margin * 2;
  let y = 0;

  // ── Header background
  doc.setFillColor(200, 75, 49); // terracotta
  doc.rect(0, 0, pageW, 38, "F");

  // ── Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("Save & Cook", margin, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(255, 220, 210);
  doc.text("Liste de courses", margin, 24);
  doc.text(`Semaine du ${weekLabel}`, margin, 31);

  // ── Stats bar
  doc.setFillColor(82, 121, 111); // sage
  doc.rect(0, 38, pageW, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`${data.total_meals} repas planifies`, margin, 46);
  doc.text(`${data.total_ingredients} articles`, margin + 55, 46);
  doc.text(`${data.total_calories.toLocaleString("fr-FR")} kcal au total`, margin + 95, 46);

  y = 60;

  // ── Meals
  data.meals.forEach((meal, idx) => {
    // Check page overflow
    const itemsHeight = meal.ingredients.length * 7 + 24;
    if (y + itemsHeight > 280) {
      doc.addPage();
      y = 20;
    }

    // Day + Meal header
    doc.setFillColor(243, 241, 237); // bone muted
    doc.roundedRect(margin, y, colW, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(44, 42, 38); // text primary
    doc.text(`${meal.day_label}  —  ${meal.meal_label}`, margin + 4, y + 7);

    // Recipe title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(200, 75, 49); // terracotta
    doc.text(meal.recipe_title, margin + 4, y + 17);

    // Servings + calories
    doc.setFontSize(8);
    doc.setTextColor(138, 135, 130); // muted
    const metaStr = `${meal.servings} portions${meal.calories > 0 ? `  •  ${meal.calories} kcal` : ""}`;
    doc.text(metaStr, margin + 4, y + 23);

    y += 27;

    // Ingredients
    meal.ingredients.forEach((ing) => {
      if (y > 278) {
        doc.addPage();
        y = 20;
      }

      // Checkbox
      doc.setDrawColor(229, 224, 216);
      doc.setLineWidth(0.4);
      doc.roundedRect(margin + 2, y - 3.5, 4, 4, 0.5, 0.5, "S");

      // Quantity + Unit (bold)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(44, 42, 38);
      const qtyStr = `${ing.quantity || ""} ${ing.unit || ""}`.trim();
      if (qtyStr) {
        doc.text(qtyStr, margin + 9, y);
      }

      // Name (normal)
      doc.setFont("helvetica", "normal");
      doc.setTextColor(92, 89, 85);
      const nameX = qtyStr ? margin + 9 + doc.getTextWidth(qtyStr) + 2 : margin + 9;
      doc.text(ing.name || "", nameX, y);

      // Notes in italic
      if (ing.notes) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(138, 135, 130);
        const notesX = nameX + doc.getTextWidth(ing.name || "") + 3;
        doc.text(`(${ing.notes})`, notesX, y);
      }

      // Separator line
      doc.setDrawColor(243, 241, 237);
      doc.setLineWidth(0.2);
      doc.line(margin + 8, y + 2, pageW - margin, y + 2);

      y += 7;
    });

    y += 6; // gap between meals
  });

  // ── Footer
  const footerY = 290;
  doc.setFillColor(250, 249, 246);
  doc.rect(0, footerY - 6, pageW, 12, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(138, 135, 130);
  doc.text("Généré par Save & Cook • saveandcook.app", margin, footerY);
  doc.text(
    `${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
    pageW - margin,
    footerY,
    { align: "right" }
  );

  return doc;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ShoppingListModal({ weekKey, weekLabel, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    axios.get(`${API}/plans/${weekKey}/shopping-list`)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [weekKey]);

  const toggleCheck = (mealIdx, ingIdx) => {
    const key = `${mealIdx}-${ingIdx}`;
    setChecked(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownload = () => {
    if (!data) return;
    setGenerating(true);
    try {
      const doc = buildPDF(data, weekLabel);
      doc.save(`liste-de-courses-${weekKey}.pdf`);
    } catch (e) {
      console.error("PDF error:", e);
    } finally {
      setGenerating(false);
    }
  };

  const totalChecked = Object.values(checked).filter(Boolean).length;
  const totalItems = data?.total_ingredients || 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-3xl border border-[#E5E0D8] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-up"
        data-testid="shopping-list-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#F3F1ED] flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-[#52796F] rounded-xl flex items-center justify-center">
                <ShoppingCart size={16} strokeWidth={1.5} className="text-white" />
              </div>
              <h2 className="font-display text-xl font-semibold text-[#2D2A26]">
                Liste de courses
              </h2>
            </div>
            <p className="text-sm text-[#8A8782]">Semaine du {weekLabel}</p>
          </div>
          <button
            data-testid="close-shopping-modal"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#F3F1ED] text-[#8A8782] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="text-[#C84B31] animate-spin" />
              <p className="text-sm text-[#8A8782]">Compilation des ingrédients…</p>
            </div>
          ) : !data || data.total_meals === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <Package size={40} strokeWidth={1} className="text-[#E5E0D8]" />
              <p className="font-semibold text-[#2D2A26]">Aucun repas planifié</p>
              <p className="text-sm text-[#8A8782]">Ajoutez des recettes à votre planning pour générer une liste de courses.</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#F3F1ED] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#2D2A26]">{data.total_meals}</p>
                  <p className="text-xs text-[#8A8782]">repas</p>
                </div>
                <div className="bg-[#F3F1ED] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#2D2A26]">{totalItems}</p>
                  <p className="text-xs text-[#8A8782]">articles</p>
                </div>
                <div className="bg-[#F3F1ED] rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-[#C84B31]">{data.total_calories.toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-[#8A8782]">kcal</p>
                </div>
              </div>

              {/* Progress bar */}
              {totalChecked > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-[#8A8782] mb-1.5">
                    <span>{totalChecked} article{totalChecked > 1 ? "s" : ""} cochés</span>
                    <span>{totalItems - totalChecked} restants</span>
                  </div>
                  <div className="h-1.5 bg-[#F3F1ED] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#52796F] rounded-full transition-all duration-300"
                      style={{ width: `${(totalChecked / totalItems) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Meals + Ingredients */}
              {data.meals.map((meal, mealIdx) => (
                <div key={mealIdx} data-testid={`shopping-meal-${mealIdx}`}>
                  {/* Meal header */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-px bg-[#E5E0D8]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#52796F] px-2 whitespace-nowrap">
                      {meal.day_label} — {meal.meal_label}
                    </span>
                    <div className="flex-1 h-px bg-[#E5E0D8]" />
                  </div>

                  {/* Recipe name */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-[#F3F1ED] rounded-lg flex items-center justify-center flex-shrink-0">
                      <ChefHat size={12} strokeWidth={1.5} className="text-[#C84B31]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2D2A26]">{meal.recipe_title}</p>
                      <p className="text-xs text-[#8A8782]">
                        {meal.servings} portions
                        {meal.calories > 0 && ` • ${meal.calories} kcal`}
                      </p>
                    </div>
                  </div>

                  {/* Ingredients list */}
                  <ul className="space-y-1.5 ml-2" data-testid={`ingredients-meal-${mealIdx}`}>
                    {meal.ingredients.map((ing, ingIdx) => {
                      const key = `${mealIdx}-${ingIdx}`;
                      const isChecked = checked[key];
                      return (
                        <li key={ingIdx}>
                          <button
                            data-testid={`ingredient-check-${key}`}
                            onClick={() => toggleCheck(mealIdx, ingIdx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                              isChecked
                                ? "bg-[#52796F]/8 opacity-60"
                                : "hover:bg-[#FAF9F6]"
                            }`}
                          >
                            <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                              isChecked
                                ? "bg-[#52796F] border-[#52796F]"
                                : "border-[#E5E0D8]"
                            }`}
                              style={{ width: "18px", height: "18px" }}
                            >
                              {isChecked && <Check size={11} strokeWidth={2.5} className="text-white" />}
                            </div>
                            <span className={`text-sm flex-1 ${isChecked ? "line-through text-[#8A8782]" : "text-[#5C5955]"}`}>
                              {ing.quantity && (
                                <strong className={`${isChecked ? "" : "text-[#2D2A26]"} mr-1`}>
                                  {ing.quantity} {ing.unit}
                                </strong>
                              )}
                              {ing.name}
                              {ing.notes && (
                                <span className="text-[#8A8782] italic ml-1">({ing.notes})</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {data && data.total_meals > 0 && (
          <div className="border-t border-[#F3F1ED] p-4 flex gap-3 flex-shrink-0">
            <button
              data-testid="download-pdf-btn"
              onClick={handleDownload}
              disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 bg-[#C84B31] hover:bg-[#A83F29] text-white rounded-full py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            >
              {generating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Télécharger le PDF
            </button>
            <button
              data-testid="close-shopping-footer-btn"
              onClick={onClose}
              className="px-5 py-2.5 bg-[#F3F1ED] hover:bg-[#E5E0D8] text-[#5C5955] rounded-full text-sm font-semibold transition-all"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
