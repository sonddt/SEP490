import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PageLoader from './components/common/PageLoader';

// Public pages
import HomePage from './pages/HomePage';
import CourtsListing from './pages/CourtsListing';
import VenueDetails from './pages/VenueDetails';
import ChatPage from './pages/ChatPage';
import Contact from './pages/Contact';
import About from './pages/About';
import BookingTimeline from './pages/BookingTimeline';
import BookingConfirm from './pages/BookingConfirm';
import BookingPayment from './pages/BookingPayment';
import BookingComplete from './pages/BookingComplete';
import TermsOfService from './pages/TermsOfService';

// Auth
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import ProtectedRoute from './components/auth/ProtectedRoute';

// User / Profile
import MyProfile from './pages/user/MyProfile';
import UserProfileEdit from './pages/user/UserProfileEdit';
import UserProfileChangePassword from './pages/user/UserProfileChangePassword';
import UserProfileOtherSetting from './pages/user/UserProfileOtherSetting';
import UserManagerInfo from './pages/user/UserManagerInfo';

// Manager — Layout + Pages
import ManagerLayout from './layouts/ManagerLayout';
import ManagerVenueList from './pages/manager/ManagerVenueList';
import ManagerAddVenue from './pages/manager/ManagerAddVenue';
import ManagerEditVenue from './pages/manager/ManagerEditVenue';
import ManagerVenueCourts from './pages/manager/ManagerVenueCourts';
import ManagerAddCourt from './pages/manager/ManagerAddCourt';
import ManagerBookings from './pages/manager/ManagerBookings';
import ManagerNotifications from './pages/manager/ManagerNotifications';
import ManagerEarnings from './pages/manager/ManagerEarnings';
import ManagerPaymentSettings from './pages/manager/ManagerPaymentSettings';
import ManagerAvailability from './pages/manager/ManagerAvailability';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminManagerRequests from './pages/admin/AdminManagerRequests';
import AdminBookingsStats from './pages/admin/AdminBookingsStats';
import AdminRevenueStats from './pages/admin/AdminRevenueStats';

const GOOGLE_CLIENT_ID = '993428936543-3tfatp8ak872p2j248tq3lbbqoi4r2ue.apps.googleusercontent.com';

const PlaceholderPage = ({ title }) => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="text-center py-5">
      <h2>{title}</h2>
      <p className="text-muted">Trang đang được phát triển.</p>
    </div>
  </div>
);

function App() {
  const location = useLocation();
  const authRoutes = ['/login', '/register', '/forgot-password', '/change-password'];
  const isAuthPage = authRoutes.includes(location.pathname);
  const isAdminPage = location.pathname.startsWith('/admin');
  const isManagerPage = location.pathname.startsWith('/manager');

  const showHeaderFooter = !isAuthPage && !isAdminPage && !isManagerPage;

  return (
    <>
      <PageLoader />
      {showHeaderFooter && <Header transparent={location.pathname === '/'} />}

      <div className={showHeaderFooter ? 'main-content' : undefined}>
        <Routes>
          {/* ═══ Home ═══ */}
          <Route path="/" element={<HomePage />} />

          {/* ═══ Auth ═══ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* ═══ Public — Courts (Player) ═══ */}
          <Route path="/courts" element={<CourtsListing />} />
          <Route path="/courts/list" element={<CourtsListing />} />
          <Route path="/courts/map" element={<PlaceholderPage title="Bản đồ sân" />} />
          <Route path="/venue-details/:venueId" element={<VenueDetails />} />
          <Route path="/courts/:id" element={<VenueDetails />} />

          {/* ═══ Booking flow ═══ */}
          <Route path="/booking" element={<BookingTimeline />} />
          <Route path="/booking/confirm" element={<ProtectedRoute><BookingConfirm /></ProtectedRoute>} />
          <Route path="/booking/payment" element={<ProtectedRoute><BookingPayment /></ProtectedRoute>} />
          <Route path="/booking/complete" element={<ProtectedRoute><BookingComplete /></ProtectedRoute>} />

          {/* ═══ Unified Profile (ALWAYS /profile, never role-specific) ═══ */}
          <Route path="/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><UserProfileEdit /></ProtectedRoute>} />
          <Route path="/profile/manager-info" element={<ProtectedRoute><UserManagerInfo /></ProtectedRoute>} />
          <Route path="/profile/change-password" element={<ProtectedRoute><UserProfileChangePassword /></ProtectedRoute>} />
          <Route path="/profile/settings" element={<ProtectedRoute><UserProfileOtherSetting /></ProtectedRoute>} />

          {/* Legacy /user/* redirects → /profile */}
          <Route path="/user/dashboard" element={<Navigate to="/profile" replace />} />
          <Route path="/user/my-profile" element={<Navigate to="/profile" replace />} />
          <Route path="/user/profile" element={<Navigate to="/profile/edit" replace />} />
          <Route path="/user/profile/manager-info" element={<Navigate to="/profile/manager-info" replace />} />
          <Route path="/user/profile/change-password" element={<Navigate to="/profile/change-password" replace />} />
          <Route path="/user/profile/other-settings" element={<Navigate to="/profile/settings" replace />} />

          {/* Player misc */}
          <Route path="/user/bookings" element={<ProtectedRoute><PlaceholderPage title="Lịch đặt sân" /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

          {/* ═══════════════════════════════════════════════════════════
               MANAGER — Nested routes with ManagerLayout (sidebar)
             ═══════════════════════════════════════════════════════════ */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute requiredRole="MANAGER">
                <ManagerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/manager/venues" replace />} />

            {/* Venue CRUD */}
            <Route path="venues" element={<ManagerVenueList />} />
            <Route path="venues/add" element={<ManagerAddVenue />} />
            <Route path="venues/:venueId/edit" element={<ManagerEditVenue />} />
            <Route path="venues/:venueId/availability" element={<ManagerAvailability />} />

            {/* Court CRUD (within venue) */}
            <Route path="venues/:venueId/courts" element={<ManagerVenueCourts />} />
            <Route path="venues/:venueId/courts/add" element={<ManagerAddCourt />} />
            <Route path="venues/:venueId/courts/:courtId/edit" element={<ManagerAddCourt />} />

            {/* Bookings (merged: pending / upcoming / completed / rejected / cancelled) */}
            <Route path="bookings" element={<ManagerBookings />} />

            {/* Notifications */}
            <Route path="notifications" element={<ManagerNotifications />} />

            {/* Finance */}
            <Route path="earnings" element={<ManagerEarnings />} />
            <Route path="payment-settings" element={<ManagerPaymentSettings />} />
          </Route>

          {/* ═══ Static pages ═══ */}
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<TermsOfService />} />

          {/* ═══ Admin ═══ */}
          <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/accounts" element={<ProtectedRoute requiredRole="ADMIN"><AdminAccounts /></ProtectedRoute>} />
          <Route path="/admin/manager-requests" element={<ProtectedRoute requiredRole="ADMIN"><AdminManagerRequests /></ProtectedRoute>} />
          <Route path="/admin/bookings-stats" element={<ProtectedRoute requiredRole="ADMIN"><AdminBookingsStats /></ProtectedRoute>} />
          <Route path="/admin/revenue-stats" element={<ProtectedRoute requiredRole="ADMIN"><AdminRevenueStats /></ProtectedRoute>} />

          {/* ═══ 404 ═══ */}
          <Route path="*" element={<PlaceholderPage title="404 – Không tìm thấy trang" />} />
        </Routes>
      </div>

      {showHeaderFooter && <Footer />}
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
