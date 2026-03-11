import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import CourtsListing from './pages/CourtsListing';
import CoachCourts from './pages/CoachCourts';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import SettingPassword from './pages/SettingPassword';

// ── Placeholder pages (to be replaced one by one) ──────────────────────────
const PlaceholderPage = ({ title }) => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="text-center py-5">
      <h2>{title}</h2>
      <p className="text-muted">This page is under construction.</p>
    </div>
  </div>
);

function App() {
  const location = useLocation();
  const authRoutes = ['/login', '/register', '/forgot-password', '/change-password'];
  const isAuthPage = authRoutes.includes(location.pathname);

  return (
    <>
      {!isAuthPage && <Header transparent={location.pathname === '/'} />}

      <Routes>
        {/* Home */}
        <Route path="/" element={<HomePage />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Venues / Courts - Danh sách sân (listing-grid + listing-list) */}
        <Route path="/courts" element={<CourtsListing />} />
        <Route path="/courts/list" element={<CourtsListing />} />
        <Route path="/courts/map" element={<PlaceholderPage title="Courts Map" />} />
        <Route path="/courts/add" element={<PlaceholderPage title="List Your Court" />} />
        <Route path="/venue-details" element={<PlaceholderPage title="Venue Details" />} />

        {/* Booking flow */}
        <Route path="/booking" element={<PlaceholderPage title="Book a Court" />} />

        {/* User dashboard */}
        <Route path="/user/dashboard" element={<PlaceholderPage title="User Dashboard" />} />
        <Route path="/user/bookings" element={<PlaceholderPage title="My Bookings" />} />
        <Route path="/user/profile" element={<PlaceholderPage title="My Profile" />} />
        <Route path="/user/wallet" element={<PlaceholderPage title="My Wallet" />} />

        {/* Coach dashboard */}
        <Route path="/coach/dashboard" element={<PlaceholderPage title="Coach Dashboard" />} />
        <Route path="/coach/courts" element={<CoachCourts />} />
        <Route path="/coach/setting-password" element={<SettingPassword />} />

        {/* Static / Info pages */}
        <Route path="/about" element={<PlaceholderPage title="About Us" />} />
        <Route path="/contact" element={<PlaceholderPage title="Contact Us" />} />
        <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
        <Route path="/services" element={<PlaceholderPage title="Services" />} />
        <Route path="/pricing" element={<PlaceholderPage title="Pricing" />} />
        <Route path="/faq" element={<PlaceholderPage title="FAQ" />} />
        <Route path="/coaches" element={<PlaceholderPage title="Coaches" />} />
        <Route path="/coach-detail" element={<PlaceholderPage title="Coach Detail" />} />
        <Route path="/terms" element={<PlaceholderPage title="Terms & Conditions" />} />
        <Route path="/privacy-policy" element={<PlaceholderPage title="Privacy Policy" />} />

        {/* 404 */}
        <Route path="*" element={<PlaceholderPage title="404 – Page Not Found" />} />
      </Routes>

      {!isAuthPage && <Footer />}
    </>
  );
}

export default App;
