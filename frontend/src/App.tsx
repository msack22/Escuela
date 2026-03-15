import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';

import Navbar from './components/Navbar/Navbar';
import ContestList from './pages/ContestList/ContestList';
import ContestListAntD from './pages/ContestList/ContestListAntD';
import AlertManagement from './pages/AlertManagement/AlertManagement';
import Dashboard from './pages/Dashboard/Dashboard';
import ScrapingStatus from './pages/ScrapingStatus/ScrapingStatus';
import CapacitacionesPage from './pages/Capacitaciones/CapacitacionesPage';
import ContestListFinal from './pages/ContestList/ContestListFinal';
import UserManagement from './pages/UserManagement/UserManagement';
import SchedulerControl from './pages/SchedulerControl/SchedulerControl';

function App() {
  return (
    <ConfigProvider locale={esES}>
      <div className="App">
        <Navbar />
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contests" element={<ContestList />} />
            <Route path="/contests-antd" element={<ContestListAntD />} />
            <Route path="/contests-improved" element={<ContestListFinal />} />
            <Route path="/scraping" element={<ScrapingStatus />} />
            <Route path="/alerts" element={<AlertManagement />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/scheduler" element={<SchedulerControl />} />
            <Route path="/capacitaciones" element={<CapacitacionesPage />} />
          </Routes>
        </Container>
      </div>
    </ConfigProvider>
  );
}

export default App;
