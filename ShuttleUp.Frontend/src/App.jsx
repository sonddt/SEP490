import { Routes, Route, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import PageLoader from './components/common/PageLoader';
import HomePage from './pages/HomePage';
import CourtsListing from './pages/CourtsListing';
import ManagerCourts from './pages/ManagerCourts';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import ManagerAddVenue from './pages/manager/ManagerAddVenue';
import ManagerAvailability from './pages/manager/ManagerAvailability';
import ManagerEarnings from './pages/manager/ManagerEarnings';
import ManagerWallet from './pages/manager/ManagerWallet';
import VenueDetails from './pages/VenueDetails';
import ChatPage from './pages/ChatPage';
import Contact from './pages/Contact';
import About from './pages/About';
import BookingTimeline from './pages/BookingTimeline';
import BookingConfirm from './pages/BookingConfirm';
import BookingPayment from './pages/BookingPayment';
import BookingComplete from './pages/BookingComplete';

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

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminManagerRequests from './pages/admin/AdminManagerRequests';
import AdminBookingsStats from './pages/admin/AdminBookingsStats';
import AdminRevenueStats from './pages/admin/AdminRevenueStats';

const GOOGLE_CLIENT_ID = '993428936543-3tfatp8ak872p2j248tq3lbbqoi4r2ue.apps.googleusercontent.com';

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
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <>
      <PageLoader />
      {/* Show header everywhere except auth pages and admin pages */}
      {!isAuthPage && !isAdminPage && <Header transparent={location.pathname === '/'} />}

      <div className="main-content">
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
        <Route path="/venue-details" element={<VenueDetails />} />
        <Route path="/courts/:id" element={<VenueDetails />} />

        {/* Booking flow */}
        <Route path="/booking" element={<BookingTimeline />} />
        <Route path="/booking/confirm"  element={<ProtectedRoute><BookingConfirm /></ProtectedRoute>} />
        <Route path="/booking/payment"  element={<ProtectedRoute><BookingPayment /></ProtectedRoute>} />
        <Route path="/booking/complete" element={<ProtectedRoute><BookingComplete /></ProtectedRoute>} />

        {/* User (yêu cầu đăng nhập – UserDashboardMenu, UserProfileTabs chỉ hiện trong các trang này) */}
        {/* Dashboard chính của user → trang MyProfile */}
        <Route path="/user/dashboard" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
        {/* Alias cũ /user/my-profile vẫn trỏ về cùng trang để không bị 404 */}
        <Route path="/user/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />

        {/* Khu vực cài đặt hồ sơ */}
        <Route path="/user/profile" element={<ProtectedRoute><UserProfileEdit /></ProtectedRoute>} />
        <Route path="/user/profile/change-password" element={<ProtectedRoute><UserProfileChangePassword /></ProtectedRoute>} />
        <Route path="/user/profile/other-settings" element={<ProtectedRoute><UserProfileOtherSetting /></ProtectedRoute>} />
        <Route path="/user/bookings" element={<ProtectedRoute><PlaceholderPage title="My Bookings" /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/user/chat" element={<ProtectedRoute><PlaceholderPage title="Chat" /></ProtectedRoute>} />
        <Route path="/user/invoices" element={<ProtectedRoute><PlaceholderPage title="Invoices" /></ProtectedRoute>} />
        <Route path="/user/wallet" element={<ProtectedRoute><PlaceholderPage title="My Wallet" /></ProtectedRoute>} />

        {/* Manager (Quản lý sân) – yêu cầu đăng nhập */}
        <Route path="/manager/dashboard"   element={<ProtectedRoute><ManagerDashboard /></ProtectedRoute>} />
        <Route path="/manager/courts"      element={<ProtectedRoute><ManagerCourts /></ProtectedRoute>} />
        <Route path="/manager/courts/add"  element={<ProtectedRoute><ManagerAddVenue /></ProtectedRoute>} />
        <Route path="/manager/availability" element={<ProtectedRoute><ManagerAvailability /></ProtectedRoute>} />
        <Route path="/manager/earnings"    element={<ProtectedRoute><ManagerEarnings /></ProtectedRoute>} />
        <Route path="/manager/wallet"      element={<ProtectedRoute><ManagerWallet /></ProtectedRoute>} />
        <Route path="/manager/requests"    element={<ProtectedRoute><PlaceholderPage title="Yêu cầu đặt sân" /></ProtectedRoute>} />
        <Route path="/manager/bookings"    element={<ProtectedRoute><PlaceholderPage title="Lịch đặt sân" /></ProtectedRoute>} />
        <Route path="/manager/chat"        element={<ProtectedRoute><PlaceholderPage title="Trò chuyện" /></ProtectedRoute>} />
        <Route path="/manager/profile"     element={<ProtectedRoute><PlaceholderPage title="Hồ sơ Quản lý" /></ProtectedRoute>} />
        <Route path="/manager/setting-password" element={<ProtectedRoute><SettingPassword /></ProtectedRoute>} />

        {/* Static / Info pages */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
        <Route path="/services" element={<PlaceholderPage title="Services" />} />
        <Route path="/pricing" element={<PlaceholderPage title="Pricing" />} />
        <Route path="/faq" element={<PlaceholderPage title="FAQ" />} />
        <Route path="/managers" element={<PlaceholderPage title="Quản lý sân" />} />
        <Route path="/manager-detail" element={<PlaceholderPage title="Chi tiết Quản lý sân" />} />
        <Route path="/terms" element={<PlaceholderPage title="Terms & Conditions" />} />
        <Route path="/privacy-policy" element={<PlaceholderPage title="Privacy Policy" />} />

        {/* Admin (yêu cầu role ADMIN) */}
        <Route path="/admin/dashboard"        element={<ProtectedRoute requiredRole="ADMIN"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/accounts"         element={<ProtectedRoute requiredRole="ADMIN"><AdminAccounts /></ProtectedRoute>} />
        <Route path="/admin/manager-requests" element={<ProtectedRoute requiredRole="ADMIN"><AdminManagerRequests /></ProtectedRoute>} />
        <Route path="/admin/bookings-stats"   element={<ProtectedRoute requiredRole="ADMIN"><AdminBookingsStats /></ProtectedRoute>} />
        <Route path="/admin/revenue-stats"    element={<ProtectedRoute requiredRole="ADMIN"><AdminRevenueStats /></ProtectedRoute>} />

        {/* 404 */}
        <Route path="*" element={<PlaceholderPage title="404 – Page Not Found" />} />
      </Routes>
      </div>

      {!isAuthPage && !isAdminPage && <Footer />}
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
