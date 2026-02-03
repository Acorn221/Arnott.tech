import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Route,Routes } from "react-router-dom";

import { StandardLayout } from "@/layout/StandardLayout";
import { RickRoll } from "@/misc/RickRoll";
import { Dev } from "@/pages/Dev";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";
import { useAppDispatch } from "@/store/hooks";
import { addSpins } from "@/store/slices/gameSlice";

import { LighterfuelUninstall } from "./pages/Projects/LighterFuel/uninstall";

// Lazy load heavy pages
const StimulationSpinner = lazy(() =>
  import("@/pages/StimulationSpinner").then((m) => ({ default: m.StimulationSpinner })),
);

const DevKeyboardShortcuts = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (import.meta.env.PROD) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "=") {
        dispatch(addSpins(1_000_000_000));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  return null;
};

export const App = () => (
  <Router>
    <DevKeyboardShortcuts />
    <Routes>
      <Route path="/r" element={<RickRoll />} />
      <Route
        path="/projects/lighterfuel/uninstall"
        element={<LighterfuelUninstall />}
      />
      <Route path="/dev" element={<Dev />} />
      <Route
        path="/stimulation-spinner"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <StimulationSpinner />
          </Suspense>
        }
      />
      <Route element={<StandardLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="J4a-website/" element={<Home />} />
        <Route path="/*" element={<NotFound />} />
      </Route>
    </Routes>
  </Router>
);
