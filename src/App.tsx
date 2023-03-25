import React from 'react';

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import StandardLayout from '@/layout/StandardLayout';
import RickRoll from '@/misc/RickRoll';

const App = () => (
  <Router>
    <Routes>
      <Route path="/r" element={<RickRoll />} />
      <Route element={<StandardLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="J4a-website/" element={<Home />} />
        <Route path="/*" element={<NotFound />} />
      </Route>
    </Routes>
  </Router>
);

export default App;
