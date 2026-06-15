import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import Landing from './pages/Landing';
import ForDJs from './pages/ForDJs';
import DJLogin from './pages/DJLogin';
import DJDashboard from './pages/DJDashboard';
import InviteHandler from './pages/InviteHandler';
import ResetPassword from './pages/ResetPassword';
import SpotifyCallback from './pages/SpotifyCallback';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/for-djs" element={<ForDJs />} />
        <Route path="/dj/login" element={<DJLogin />} />
        <Route path="/dj/*" element={<DJDashboard />} />
        <Route path="/app/*" element={<App />} />
        <Route path="/invite/:token" element={<InviteHandler />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/callback" element={<SpotifyCallback />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
