import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import Navigation from "@/components/Navigation";
import IngestPage from "@/components/IngestPage";
import RecipesPage from "@/components/RecipesPage";
import RecipeDetail from "@/components/RecipeDetail";
import PlannerPage from "@/components/PlannerPage";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<IngestPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </div>
  );
}

export default App;
