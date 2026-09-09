import { Outlet } from 'react-router-dom';
import { BrandMark } from '../components/Icons';

export function AuthLayout() {
  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <BrandMark />
          Ledgerline
        </div>
        <Outlet />
      </div>
    </div>
  );
}
