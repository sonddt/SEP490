import { Navigate } from 'react-router-dom';

/**
 * VenuesGrid is merged into the unified VenuesListing page.
 * /venues already shows the grid view.
 */
export default function VenuesGrid() {
  return <Navigate to="/venues" replace />;
}

