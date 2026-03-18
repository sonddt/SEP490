import { Navigate } from 'react-router-dom';

/**
 * CourtsGrid is merged into the unified CourtsListing page.
 * /courts already shows the grid view.
 */
export default function CourtsGrid() {
  return <Navigate to="/courts" replace />;
}
