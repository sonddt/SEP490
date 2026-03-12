import { Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PageLoader from './components/common/PageLoader';
import HomePage from './pages/HomePage';
import CourtsListing from './pages/CourtsListing';
import CoachCourts from './pages/CoachCourts';

// Auth
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import SettingPassword from './pages/SettingPassword';

// Auth guard
import ProtectedRoute from './components/auth/ProtectedRoute';

// User Profile (chỉ hiện khi đã đăng nhập)
import MyProfile from './pages/user/MyProfile';
import UserProfileEdit from './pages/user/UserProfileEdit';
import UserProfileChangePassword from './pages/user/UserProfileChangePassword';
import UserProfileOtherSetting from './pages/user/UserProfileOtherSetting';

const GOOGLE_CLIENT_ID = '1093055812182-vekuqfsn7hhh18e6k7hfunlht5dt7t3r.apps.googleusercontent.com';

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
      <PageLoader />
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

        {/* User (yêu cầu đăng nhập – UserDashboardMenu, UserProfileTabs chỉ hiện trong các trang này) */}
        <Route path="/user/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
        <Route path="/user/profile" element={<ProtectedRoute><UserProfileEdit /></ProtectedRoute>} />
        <Route path="/user/profile/change-password" element={<ProtectedRoute><UserProfileChangePassword /></ProtectedRoute>} />
        <Route path="/user/profile/other-settings" element={<ProtectedRoute><UserProfileOtherSetting /></ProtectedRoute>} />
        <Route path="/user/dashboard" element={<ProtectedRoute><PlaceholderPage title="User Dashboard" /></ProtectedRoute>} />
        <Route path="/user/bookings" element={<ProtectedRoute><PlaceholderPage title="My Bookings" /></ProtectedRoute>} />
        <Route path="/user/chat" element={<ProtectedRoute><PlaceholderPage title="Chat" /></ProtectedRoute>} />
        <Route path="/user/invoices" element={<ProtectedRoute><PlaceholderPage title="Invoices" /></ProtectedRoute>} />
        <Route path="/user/wallet" element={<ProtectedRoute><PlaceholderPage title="My Wallet" /></ProtectedRoute>} />

        {/* Manager (Coach) */}
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

function AppWithProviders() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default AppWithProviders;
