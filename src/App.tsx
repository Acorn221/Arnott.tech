import React from 'react';
import Helmet from 'react-helmet';

import {
  BrowserRouter as Router,
  Routes,
  Route,
} from 'react-router-dom';

import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import StandardLayout from '@/layout/StandardLayout';

const App = () => (
  <>
    <Helmet bodyAttributes={{ style: 'background-color : rgb(15 23 42)' }}>
      <title>James Arnott</title>
    </Helmet>
    <Router>
      <Routes>
        <Route element={<StandardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  </>
);

export default App;
