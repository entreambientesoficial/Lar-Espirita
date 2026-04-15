import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import BemVindo from './pages/BemVindo';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Checkin from './pages/Checkin';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<BemVindo />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Layout>
  );
}

export default App;
