import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChefHat, BookOpen, CalendarDays, Plus, Menu, X } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const navLinks = [
  { to: "/", label: "Extraire", icon: Plus },
  { to: "/recipes", label: "Recettes", icon: BookOpen },
  { to: "/planner", label: "Planificateur", icon: CalendarDays },
];

export default function Navigation() {
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    axios.get(`${API}/stats`).then(r => setStats(r.data)).catch(() => {});
  }, [location.pathname]);

  return (
    <header
      data-testid="main-navigation"
      className="sticky top-0 z-50 backdrop-blur-xl bg-[#FAF9F6]/90 border-b border-[#E5E0D8]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            data-testid="nav-logo"
          >
            <div className="w-9 h-9 bg-[#C84B31] rounded-xl flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <ChefHat size={20} strokeWidth={1.5} className="text-white" />
            </div>
            <div>
              <span className="font-display font-semibold text-lg text-[#2D2A26] leading-none block">
                Save & Cook
              </span>
              {stats && (
                <span className="text-xs text-[#8A8782] font-body">
                  {stats.total_recipes} recette{stats.total_recipes !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-[#C84B31] text-white shadow-sm"
                      : "text-[#5C5955] hover:bg-[#F3F1ED] hover:text-[#2D2A26]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg text-[#5C5955] hover:bg-[#F3F1ED]"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden pb-3 border-t border-[#E5E0D8] pt-2">
            {navLinks.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-[#C84B31]/10 text-[#C84B31]"
                      : "text-[#5C5955] hover:bg-[#F3F1ED]"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
