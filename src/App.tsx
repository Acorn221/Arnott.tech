import React, { useEffect } from 'react';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import ReactGA from 'react-ga4';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import StandardLayout from '@/layout/StandardLayout';
import RickRoll from '@/misc/RickRoll';
import { LighterfuelUninstall } from './pages/Projects/LighterFuel/uninstall';

const App = () => (
  <Router>
    <Routes>
      <Route path="/r" element={<RickRoll />} />
      <Route path="/projects/lighterfuel/uninstall" element={<LighterfuelUninstall />} />
      <Route element={<StandardLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="J4a-website/" element={<Home />} />
        <Route path="/*" element={<NotFound />} />
      </Route>
    </Routes>
  </Router>
);

export default App;
