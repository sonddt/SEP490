import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bootstrap is loaded from the template in index.html to preserve the CSS cascading order.

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
