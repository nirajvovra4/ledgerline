import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthLayout } from './layout/AuthLayout';
import { RequireAuth } from './layout/RequireAuth';
import { WorkspaceBareLayout, WorkspaceLayout } from './layout/WorkspaceLayout';
import { ErrorPage } from './pages/ErrorPage';
import { NotFoundPage } from './pages/NotFoundPage';

type PageModule = Record<string, ComponentType>;

/** Lazily load one named export from an area module so each area becomes its own chunk. */
function area<M extends PageModule>(loader: () => Promise<M>) {
  return (name: keyof M & string): LazyExoticComponent<ComponentType> =>
    lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

const auth = area(() => import('./pages/auth'));
const workspaces = area(() => import('./pages/workspaces'));
const dashboard = area(() => import('./pages/dashboard'));
const clients = area(() => import('./pages/clients'));
const projects = area(() => import('./pages/projects'));
const time = area(() => import('./pages/time'));
const invoices = area(() => import('./pages/invoices'));
const payments = area(() => import('./pages/payments'));
const expenses = area(() => import('./pages/expenses'));
const ledger = area(() => import('./pages/ledger'));
const reports = area(() => import('./pages/reports'));
const calendar = area(() => import('./pages/calendar'));
const approvals = area(() => import('./pages/approvals'));
const notifications = area(() => import('./pages/notifications'));
const settings = area(() => import('./pages/settings'));

const LoginPage = auth('LoginPage');
const RegisterPage = auth('RegisterPage');
const InvitePage = auth('InvitePage');
const WorkspacesPage = workspaces('WorkspacesPage');
const DashboardPage = dashboard('DashboardPage');
const ClientsPage = clients('ClientsPage');
const ClientDetailPage = clients('ClientDetailPage');
const ClientFormPage = clients('ClientFormPage');
const ProjectsPage = projects('ProjectsPage');
const ProjectDetailPage = projects('ProjectDetailPage');
const ProjectFormPage = projects('ProjectFormPage');
const TimePage = time('TimePage');
const InvoicesPage = invoices('InvoicesPage');
const InvoiceEditorPage = invoices('InvoiceEditorPage');
const InvoiceFromTimePage = invoices('InvoiceFromTimePage');
const InvoiceDetailPage = invoices('InvoiceDetailPage');
const InvoicePrintPage = invoices('InvoicePrintPage');
const PaymentsPage = payments('PaymentsPage');
const ExpensesPage = expenses('ExpensesPage');
const ExpenseFormPage = expenses('ExpenseFormPage');
const ExpenseDetailPage = expenses('ExpenseDetailPage');
const AccountsPage = ledger('AccountsPage');
const AccountRegisterPage = ledger('AccountRegisterPage');
const JournalPage = ledger('JournalPage');
const JournalEntryPage = ledger('JournalEntryPage');
const ReportsIndexPage = reports('ReportsIndexPage');
const ProfitLossPage = reports('ProfitLossPage');
const BalanceSheetPage = reports('BalanceSheetPage');
const TrialBalancePage = reports('TrialBalancePage');
const ArAgingPage = reports('ArAgingPage');
const TaxSummaryPage = reports('TaxSummaryPage');
const RevenueByClientPage = reports('RevenueByClientPage');
const TimeUtilisationPage = reports('TimeUtilisationPage');
const CalendarPage = calendar('CalendarPage');
const ApprovalsPage = approvals('ApprovalsPage');
const NotificationsPage = notifications('NotificationsPage');
const SettingsPage = settings('SettingsPage');

export const routes: RouteObject[] = [
  {
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/workspaces" replace /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'invite/:token', element: <InvitePage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: 'workspaces', element: <WorkspacesPage /> },
          {
            path: 'w/:slug',
            element: <WorkspaceBareLayout />,
            children: [{ path: 'invoices/:id/print', element: <InvoicePrintPage /> }],
          },
          {
            path: 'w/:slug',
            element: <WorkspaceLayout />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              { path: 'dashboard', element: <DashboardPage /> },
              { path: 'clients', element: <ClientsPage /> },
              { path: 'clients/new', element: <ClientFormPage /> },
              { path: 'clients/:id', element: <ClientDetailPage /> },
              { path: 'clients/:id/edit', element: <ClientFormPage /> },
              { path: 'projects', element: <ProjectsPage /> },
              { path: 'projects/new', element: <ProjectFormPage /> },
              { path: 'projects/:id', element: <ProjectDetailPage /> },
              { path: 'projects/:id/edit', element: <ProjectFormPage /> },
              { path: 'time', element: <TimePage /> },
              { path: 'invoices', element: <InvoicesPage /> },
              { path: 'invoices/new', element: <InvoiceEditorPage /> },
              { path: 'invoices/from-time', element: <InvoiceFromTimePage /> },
              { path: 'invoices/:id', element: <InvoiceDetailPage /> },
              { path: 'invoices/:id/edit', element: <InvoiceEditorPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'expenses', element: <ExpensesPage /> },
              { path: 'expenses/new', element: <ExpenseFormPage /> },
              { path: 'expenses/:id', element: <ExpenseDetailPage /> },
              { path: 'expenses/:id/edit', element: <ExpenseFormPage /> },
              { path: 'ledger', element: <Navigate to="accounts" replace /> },
              { path: 'ledger/accounts', element: <AccountsPage /> },
              { path: 'ledger/accounts/:id', element: <AccountRegisterPage /> },
              { path: 'ledger/journal', element: <JournalPage /> },
              { path: 'ledger/journal/:id', element: <JournalEntryPage /> },
              { path: 'reports', element: <ReportsIndexPage /> },
              { path: 'reports/profit-loss', element: <ProfitLossPage /> },
              { path: 'reports/balance-sheet', element: <BalanceSheetPage /> },
              { path: 'reports/trial-balance', element: <TrialBalancePage /> },
              { path: 'reports/ar-aging', element: <ArAgingPage /> },
              { path: 'reports/tax-summary', element: <TaxSummaryPage /> },
              { path: 'reports/revenue-by-client', element: <RevenueByClientPage /> },
              { path: 'reports/time-utilisation', element: <TimeUtilisationPage /> },
              { path: 'calendar', element: <CalendarPage /> },
              { path: 'approvals', element: <ApprovalsPage /> },
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
