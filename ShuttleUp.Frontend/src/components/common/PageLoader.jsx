import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function PageLoader() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div id="global-loader">
      <div className="loader-img">
        <img
          src="/assets/assets/img/loader.png"
          className="img-fluid"
          alt="Loading..."
        />
      </div>
    </div>
  );
}
