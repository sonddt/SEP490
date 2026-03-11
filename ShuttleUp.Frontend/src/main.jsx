import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bootstrap CSS + JS (includes Popper)
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// AOS globally (init is done per-page)
import 'aos/dist/aos.css';

// Template CSS (copied to public/assets)
// These are loaded via index.html <link> tags below OR we can import the main one:
import './index.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
