import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { LanguageProvider } from './context/LanguageContext';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardRouter } from './pages/DashboardRouter';
import { SupplyListPage } from './pages/SupplyListPage';
import { SupplyDetailPage } from './pages/SupplyDetailPage';
import { SupplyManagePage } from './pages/SupplyManagePage';
import { CreateSupplyPage } from './pages/CreateSupplyPage';
import { DemandsPage } from './pages/DemandsPage';
import { CreateDemandPage } from './pages/CreateDemandPage';
import { MatchResultsPage } from './pages/MatchResultsPage';
import { ReviewTransactionPage } from './pages/ReviewTransactionPage';
import { CompletePaymentPage } from './pages/CompletePaymentPage';
import { SupplierRequestPage } from './pages/SupplierRequestPage';
import { LogisticsAssignmentPage } from './pages/LogisticsAssignmentPage';
import { DeliveryTrackingPage } from './pages/DeliveryTrackingPage';
import { ConfirmReceiptPage } from './pages/ConfirmReceiptPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { TransactionDetailPage } from './pages/TransactionDetailPage';
import { LogisticsJobsPage } from './pages/LogisticsJobsPage';
import { LogisticsJobDetailPage } from './pages/LogisticsJobDetailPage';
import { ShipmentsPage } from './pages/ShipmentsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminLogisticsPage } from './pages/admin/AdminLogisticsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminDisputesPage } from './pages/admin/AdminDisputesPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { useApp } from './context/AppContext';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardRouter />} />

        {/* Supply */}
        <Route path="supply" element={<SupplyListPage />} />
        <Route path="supply/:id" element={<SupplyDetailPage />} />
        <Route path="supply/manage" element={<SupplyManagePage />} />
        <Route path="supply/new" element={<CreateSupplyPage />} />

        {/* Demands */}
        <Route path="demands" element={<DemandsPage />} />
        <Route path="demands/:id" element={<DemandsPage />} />
        <Route path="demands/new" element={<CreateDemandPage />} />

        {/* Matches (Figma Screen 4) */}
        <Route path="matches" element={<MatchResultsPage />} />
        <Route path="matches/:id" element={<MatchResultsPage />} />


        {/* Transactions & Figma flow */}
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/review/:id" element={<ReviewTransactionPage />} />
        <Route path="transactions/:id/pay" element={<CompletePaymentPage />} />
        <Route path="transactions/:id/track" element={<DeliveryTrackingPage />} />
        <Route path="transactions/:id/confirm" element={<ConfirmReceiptPage />} />
        <Route path="transactions/:id" element={<TransactionDetailPage />} />

        {/* Supplier Requests (Figma Screen 7) */}
        <Route path="requests" element={<SupplierRequestPage />} />
        <Route path="requests/:id" element={<SupplierRequestPage />} />

        {/* Logistics & Figma flow */}
        <Route path="jobs" element={<LogisticsJobsPage />} />
        <Route path="jobs/:id/assignment" element={<LogisticsAssignmentPage />} />
        <Route path="jobs/:id" element={<LogisticsJobDetailPage />} />
        <Route path="assignments/:id" element={<LogisticsAssignmentPage />} />
        <Route path="shipments" element={<ShipmentsPage />} />
        <Route path="deliveries" element={<DeliveryTrackingPage />} />
        <Route path="deliveries/:id" element={<DeliveryTrackingPage />} />
        <Route path="deliveries/:id/confirm" element={<ConfirmReceiptPage />} />

        {/* Notifications */}
        <Route path="notifications" element={<NotificationsPage />} />

        {/* Admin */}
        <Route path="admin/transactions" element={<TransactionsPage />} />
        <Route path="admin/logistics" element={<AdminLogisticsPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="admin/disputes" element={<AdminDisputesPage />} />
        <Route path="admin/audit" element={<AdminAuditPage />} />

        {/* Incidents alias for Logistics */}
        <Route path="incidents" element={<AdminDisputesPage />} />

        {/* Fallback */}
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AppProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AppProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
