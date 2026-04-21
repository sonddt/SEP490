import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatProvider';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PageLoader from './components/common/PageLoader';

// Public pages
import HomePage from './pages/HomePage';
import VenuesListing from './pages/VenuesListing';
import VenueDetails from './pages/VenueDetails';
import VenueMapSearch from './pages/VenueMapSearch';
import ChatPage from './pages/ChatPage';
import Contact from './pages/Contact';
import About from './pages/About';
import FeaturedPage from './pages/FeaturedPage';
import BookingTimeline from './pages/BookingTimeline';
import BookingConfirm from './pages/BookingConfirm';
import BookingPayment from './pages/BookingPayment';
import BookingComplete from './pages/BookingComplete';

import LongTermBooking from './pages/LongTermBooking';
import LongTermConfirm from './pages/LongTermConfirm';
import LongTermFlexible from './pages/LongTermFlexible';
import LongTermFlexibleConfirm from './pages/LongTermFlexibleConfirm';
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
import Personalization from './pages/user/Personalization';
import UserManagerInfo from './pages/user/UserManagerInfo';
import UserBookings from './pages/user/UserBookings';
import UserFavorites from './pages/user/UserFavorites';
import UserNotifications from './pages/user/UserNotifications';
import UserSocialSearch from './pages/user/UserSocialSearch';
import UserSocialFriends from './pages/user/UserSocialFriends';
import UserPublicProfile from './pages/user/UserPublicProfile';
import { useAppNotificationsHub } from './hooks/useAppNotificationsHub';

// Matching
import MatchingHub from './pages/matching/MatchingHub';
import MatchingCreate from './pages/matching/MatchingCreate';
import MatchingEditPost from './pages/matching/MatchingEditPost';
import MatchingPostDetail from './pages/matching/MatchingPostDetail';

// Manager — Layout + Pages
import UserLayout from './layouts/UserLayout';
import ManagerLayout from './layouts/ManagerLayout';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerVenueList from './pages/manager/ManagerVenueList';
import ManagerAddVenue from './pages/manager/ManagerAddVenue';
import ManagerVenueCourts from './pages/manager/ManagerVenueCourts';
import ManagerAddCourt from './pages/manager/ManagerAddCourt';
import ManagerCoupons from './pages/manager/ManagerCoupons';
import ManagerBookings from './pages/manager/ManagerBookings';
import ManagerNotifications from './pages/manager/ManagerNotifications';
import ManagerEarnings from './pages/manager/ManagerEarnings';
import ManagerPaymentSettings from './pages/manager/ManagerPaymentSettings';
import ManagerAvailability from './pages/manager/ManagerAvailability';
import ManagerProfile from './pages/manager/ManagerProfile';
import ManagerRefunds from './pages/manager/ManagerRefunds';
import ManagerFeaturedPosts from './pages/manager/ManagerFeaturedPosts';
import ManagerProfileRequest from './pages/manager/ManagerProfileRequest';

// Admin — Layout + Pages
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminManagerRequests from './pages/admin/AdminManagerRequests';
import AdminBookingsStats from './pages/admin/AdminBookingsStats';
import AdminRevenueStats from './pages/admin/AdminRevenueStats';
import AdminFeaturedPosts from './pages/admin/AdminFeaturedPosts';
import AdminReports from './pages/admin/AdminReports';

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
  useAppNotificationsHub();
  const location = useLocation();
  const authRoutes = ['/login', '/register', '/forgot-password', '/change-password'];
  const isAuthPage = authRoutes.includes(location.pathname);
  const isAdminPage = location.pathname.startsWith('/admin');
  const isManagerPage = location.pathname.startsWith('/manager');
  const isBookingPage = location.pathname.startsWith('/booking');

  const showHeaderFooter = !isAuthPage && !isAdminPage && !isManagerPage;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

    // Cleanup Bootstrap artifacts on route change (fixes dark screen / stuck clicks)
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach((el) => el.remove());
  }, [location.pathname]);

  return (
    <>
      <PageLoader />
      {showHeaderFooter && <Header transparent={location.pathname === '/'} />}

      <div>
        <Routes>
          {/* ═══ Home ═══ */}
          <Route path="/" element={<HomePage />} />

          {/* ═══ Auth ═══ */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* ═══ Public — Venues (Player) ═══ */}
          <Route path="/venues" element={<VenuesListing />} />
          <Route path="/venues/list" element={<VenuesListing />} />
          <Route path="/venues/map" element={<VenueMapSearch />} />
          <Route path="/map" element={<Navigate to="/venues/map" replace />} />
          <Route path="/venue-details/:venueId" element={<VenueDetails />} />
          <Route path="/venues/:id" element={<VenueDetails />} />

          {/* Backward-compatible aliases */}
          <Route path="/courts" element={<Navigate to="/venues" replace />} />
          <Route path="/courts/list" element={<Navigate to="/venues/list" replace />} />
          <Route path="/courts/map" element={<Navigate to="/venues/map" replace />} />
          <Route path="/courts/:id" element={<Navigate to="/venues/:id" replace />} />

          {/* ═══ Booking flow ═══ */}
          <Route path="/booking" element={<BookingTimeline />} />
          <Route path="/booking/confirm" element={<ProtectedRoute><BookingConfirm /></ProtectedRoute>} />
          <Route path="/booking/payment" element={<ProtectedRoute><BookingPayment /></ProtectedRoute>} />
          <Route path="/booking/complete" element={<ProtectedRoute><BookingComplete /></ProtectedRoute>} />

          <Route path="/booking/long-term/fixed" element={<ProtectedRoute><LongTermBooking /></ProtectedRoute>} />
          <Route path="/booking/long-term/flexible" element={<ProtectedRoute><LongTermFlexible /></ProtectedRoute>} />
          <Route path="/booking/long-term/confirm" element={<ProtectedRoute><LongTermConfirm /></ProtectedRoute>} />
          <Route path="/booking/long-term/flexible/confirm" element={<ProtectedRoute><LongTermFlexibleConfirm /></ProtectedRoute>} />

          {/* ═══ Player Profile & Features ═══ */}
          <Route path="/personalization" element={<ProtectedRoute><Personalization /></ProtectedRoute>} />

          {/* Public Profile View (no sidebar) */}
          <Route path="/user/profile/:userId" element={<ProtectedRoute><UserPublicProfile /></ProtectedRoute>} />

          {/* User Layout with Sidebar */}
          <Route path="/user" element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
            <Route path="profile" element={<MyProfile />} />
            <Route path="profile/edit" element={<UserProfileEdit />} />
            <Route path="profile/manager-info" element={<UserManagerInfo />} />
            <Route path="profile/change-password" element={<UserProfileChangePassword />} />
            <Route path="profile/settings" element={<UserProfileOtherSetting />} />
            <Route path="social/search" element={<UserSocialSearch />} />
            <Route path="social/friends" element={<UserSocialFriends />} />
            <Route path="bookings" element={<UserBookings />} />
            <Route path="favorites" element={<UserFavorites />} />
            <Route path="notifications" element={<UserNotifications />} />
          </Route>

          {/* Legacy /profile redirects → /user/profile */}
          <Route path="/profile" element={<Navigate to="/user/profile" replace />} />
          <Route path="/profile/edit" element={<Navigate to="/user/profile/edit" replace />} />
          <Route path="/profile/manager-info" element={<Navigate to="/user/profile/manager-info" replace />} />
          <Route path="/profile/change-password" element={<Navigate to="/user/profile/change-password" replace />} />
          <Route path="/profile/settings" element={<Navigate to="/user/profile/settings" replace />} />

          {/* Legacy /user/* redirects */}
          <Route path="/user/dashboard" element={<Navigate to="/user/profile" replace />} />
          <Route path="/user/my-profile" element={<Navigate to="/user/profile" replace />} />

          {/* Player misc */}
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/user/chat" element={<Navigate to="/chat" replace />} />

          {/* ═══ Matching ═══ */}
          <Route path="/matching" element={<MatchingHub />} />
          <Route path="/matching/create" element={<ProtectedRoute><MatchingCreate /></ProtectedRoute>} />
          <Route path="/matching/edit/:postId" element={<ProtectedRoute><MatchingEditPost /></ProtectedRoute>} />
          <Route path="/matching/:postId" element={<MatchingPostDetail />} />

          {/* Manager Profile Request — accessible by any logged-in user (PENDING/REJECTED managers) */}
          <Route path="/manager/profile-request" element={<ProtectedRoute><ManagerProfileRequest /></ProtectedRoute>} />

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

            {/* Dashboard */}
            <Route path="dashboard" element={<ManagerDashboard />} />

            {/* Venue CRUD */}
            <Route path="venues" element={<ManagerVenueList />} />
            <Route path="venues/add" element={<ManagerAddVenue />} />
            <Route path="venues/:venueId/edit" element={<ManagerAddVenue />} />
            <Route path="venues/:venueId/availability" element={<ManagerAvailability />} />

            {/* Court CRUD (within venue) */}
            <Route path="venues/:venueId/courts" element={<ManagerVenueCourts />} />
            <Route path="venues/:venueId/courts/add" element={<ManagerAddCourt />} />
            <Route path="venues/:venueId/courts/:courtId/edit" element={<ManagerAddCourt />} />

            {/* Coupons */}
            <Route path="venues/:venueId/coupons" element={<ManagerCoupons />} />

            {/* Bookings */}
            <Route path="bookings" element={<ManagerBookings />} />
            <Route path="refunds" element={<ManagerRefunds />} />
            <Route path="featured-posts" element={<ManagerFeaturedPosts />} />

            {/* Notifications */}
            <Route path="notifications" element={<ManagerNotifications />} />

            {/* Finance */}
            <Route path="earnings" element={<ManagerEarnings />} />
            <Route path="payment-settings" element={<ManagerPaymentSettings />} />

            {/* Manager Profile */}
            <Route path="profile" element={<ManagerProfile />} />
          </Route>

          {/* ═══ Static pages ═══ */}
          <Route path="/featured" element={<FeaturedPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<TermsOfService />} />

          {/* ═══════════════════════════════════════════════════════════
               ADMIN — Nested routes with AdminLayout (sidebar)
             ═══════════════════════════════════════════════════════════ */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="accounts" element={<AdminAccounts />} />
            <Route path="manager-requests" element={<AdminManagerRequests />} />
            <Route path="bookings-stats" element={<AdminBookingsStats />} />
            <Route path="revenue-stats" element={<AdminRevenueStats />} />
            <Route path="featured-posts" element={<AdminFeaturedPosts />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>

          {/* ═══ 404 ═══ */}
          <Route path="*" element={<PlaceholderPage title="404 – Không tìm thấy trang" />} />
        </Routes>
      </div>

      {showHeaderFooter && !isBookingPage && <Footer />}

      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable={false}
        limit={5}
        style={{ marginTop: '65px' }}
      />
    </>
  );
}

function AppWithProviders() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default AppWithProviders;
