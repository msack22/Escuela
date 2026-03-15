import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';

import Navbar from './components/Navbar/Navbar.tsx';
import ContestList from './pages/ContestList/ContestList.tsx';
import AlertManagement from './pages/AlertManagement/AlertManagement.tsx';
import Dashboard from './pages/Dashboard/Dashboard.tsx';
import ScrapingStatus from './pages/ScrapingStatus/ScrapingStatus.tsx';
import CapacitacionesPage from './pages/Capacitaciones/CapacitacionesPage.tsx';
import ContestListFinal from './pages/ContestListFinal.tsx';

function App() {
  return (
    <div className="App">
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contests" element={<ContestList />} />
          <Route path="/contests-improved" element={<ContestListFinal />} />
          <Route path="/alerts" element={<AlertManagement />} />
          <Route path="/scraping" element={<ScrapingStatus />} />
          <Route path="/capacitaciones" element={<CapacitacionesPage />} />
        </Routes>
      </Container>
    </div>
  );
}

export default App;
