import type { ReactNode } from 'react';
import MainLayout from './components/layouts/MainLayout';
import ReferenceTasksManagement from './pages/admin/ReferenceTasksManagement';
import UsersManagement from './pages/admin/UsersManagement';
import FormBuilder from './pages/admin/FormBuilder';
import AuditLogs from './pages/admin/AuditLogs';
import ArchivedProjects from './pages/admin/ArchivedProjects';
import Dashboard from './pages/Dashboard';
import FinanceDashboard from './pages/finance/FinanceDashboard';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ProjectDetail from './pages/projects/ProjectDetail';
import ProjectList from './pages/projects/ProjectList';
import DesignDashboard from './pages/design/DesignDashboard';
import ApproveOrder from './pages/design/ApproveOrder';
import WarehouseDashboard from './pages/warehouse/WarehouseDashboard';
import PurchasesDashboard from './pages/purchases/PurchasesDashboard';
import QualityTickets from './pages/quality/QualityTickets';
import PurchaseInspection from './pages/quality/PurchaseInspection';
import TicketDetail from './pages/quality/TicketDetail';
import NewOrder from './pages/sales/NewOrder';
import EditOrder from './pages/sales/EditOrder';
import OrderEditRequests from './pages/sales/OrderEditRequests';

export interface RouteConfig {
  name: string;
  path?: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
  index?: boolean;
  children?: RouteConfig[];
}

export const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <Login />,
    public: true,
  },
  {
    name: 'ForgotPassword',
    path: '/forgot-password',
    element: <ForgotPassword />,
    public: true,
  },
  {
    name: 'Dashboard Layout',
    path: '/',
    element: <MainLayout />,
    children: [
      {
        name: 'Dashboard',
        index: true,
        element: <Dashboard />
      },
      {
        name: 'New Order',
        path: 'orders/new',
        element: <NewOrder />
      },
      {
        name: 'Edit Order',
        path: 'orders/edit/:id',
        element: <EditOrder />
      },
      {
        name: 'Order Edits',
        path: 'orders/edits',
        element: <OrderEditRequests />
      },
      {
        name: 'Orders',
        path: 'orders',
        element: <ProjectList />
      },
      {
        name: 'Project Detail',
        path: 'projects/:id',
        element: <ProjectDetail />
      },
      {
        name: 'Design Dashboard',
        path: 'design',
        element: <DesignDashboard />
      },
      {
        name: 'Approve Order',
        path: 'design/approve/:id',
        element: <ApproveOrder />
      },
      {
        name: 'Warehouse',
        path: 'warehouse',
        element: <WarehouseDashboard />
      },
      {
        name: 'Purchases',
        path: 'purchases',
        element: <PurchasesDashboard />
      },
      {
        name: 'Quality Tickets',
        path: 'quality',
        element: <QualityTickets />
      },
      {
        name: 'Purchase Inspection',
        path: 'quality/purchases',
        element: <PurchaseInspection />
      },
      {
        name: 'Ticket Detail',
        path: 'quality/:id',
        element: <TicketDetail />
      },
      {
        name: 'Finance',
        path: 'finance',
        element: <FinanceDashboard />
      },
      {
        name: 'Users Management',
        path: 'users',
        element: <UsersManagement />
      },
      {
        name: 'Audit Logs',
        path: 'audit-logs',
        element: <AuditLogs />
      },
      {
        name: 'Archived Projects',
        path: 'archive',
        element: <ArchivedProjects />
      },
      {
        name: 'Reference Tasks Management',
        path: 'tasks-setup',
        element: <ReferenceTasksManagement />
      },
      {
        name: 'Form Builder',
        path: 'admin/form-builder',
        element: <FormBuilder />
      },
      {
        name: 'Design',
        path: 'design',
        element: <DesignDashboard />
      },
      {
        name: 'Production',
        path: 'production',
        element: <ProjectList />
      }
    ]
  }
];
