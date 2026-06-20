import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const RouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isPublicRoute = ['/login', '/forgot-password'].includes(location.pathname);
    if (!loading && !user && !isPublicRoute) {
      navigate('/login', { replace: true });
    } else if (!loading && user && isPublicRoute) {
      navigate('/', { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const isPublicRoute = ['/login', '/forgot-password'].includes(location.pathname);
  if (!user && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
};
