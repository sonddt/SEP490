import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link to="/" className="text-xl font-bold text-blue-600">ShuttleUp</Link>
            <div className="space-x-4">
              <Link to="/login" className="text-gray-600 hover:text-blue-600">Login</Link>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Register</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
