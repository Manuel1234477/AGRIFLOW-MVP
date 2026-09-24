import { Outlet, useNavigate } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useApp } from '../../context/AppContext';
import { PageSpeakerWidget } from '../ui/PageSpeakerWidget';

export function AppLayout() {
  const { session } = useApp();
  const navigate = useNavigate();

  if (!session) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f5f6]">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>
      <PageSpeakerWidget />
    </div>
  );
}
