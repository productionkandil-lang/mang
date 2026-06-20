import React from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { RouteGuard } from '@/components/common/RouteGuard';
import { Toaster } from '@/components/ui/sonner';

import { AuthProvider } from '@/contexts/AuthContext';
import { routes } from './routes';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
    <Router>
      <AuthProvider>
      <RouteGuard>
      <IntersectObserver />
      <div className="flex flex-col min-h-screen">
        {/*<Header />*/}
        <main className="flex-grow">
          <Routes>
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            >
              {route.children?.map((child, childIndex) => (
                <Route
                  key={childIndex}
                  path={child.path}
                  index={child.index}
                  element={child.element}
                />
              ))}
            </Route>
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster />
      </RouteGuard>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
};

export default App;
