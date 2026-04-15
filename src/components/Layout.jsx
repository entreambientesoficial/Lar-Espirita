import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = ({ children }) => {
  const location = useLocation();
  const { profile, signOut, loading } = useAuth();
  const [showToast, setShowToast] = useState(false);
  const isLoginPage = location.pathname === '/';

  if (isLoginPage) return <>{children}</>;
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary">progress_activity</span></div>;

  const navItems = [
    { path: '/dashboard', label: 'Início', icon: 'home' },
    { path: '/agenda', label: 'Agenda', icon: 'calendar_month' },
    { path: '/checkin', label: 'Check-in', icon: 'qr_code_scanner' },
    { path: '/admin', label: 'Gestão', icon: 'admin_panel_settings', adminOnly: true },
  ];

  const handleRestrictedClick = (e) => {
    e.preventDefault();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="bg-background text-on-surface min-h-screen pb-32 font-body">
      {/* Restricted Access Toast */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-gray-800 text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          🔒 Acesso restrito à Diretoria
        </div>
      )}

      {/* TopAppBar */}
      <header className="flex justify-between items-center px-6 py-4 w-full sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center border border-gray-100">
             <img src="/img-apoio/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-primary font-headline block leading-tight">Casa Espírita</span>
            <span className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold opacity-60">Portal do Voluntário</span>
          </div>
        </div>
        <button 
          onClick={signOut}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-all text-primary"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </header>

      {children}

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 w-full z-50 flex justify-around items-center px-6 pb-6 pt-2 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-[2.5rem] border-t border-gray-100">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isRestricted = item.adminOnly && profile?.role !== 'admin';
          
          const Content = (
            <>
              <div className={`p-2 rounded-full transition-all ${isActive ? 'bg-primary/10' : ''}`}>
                <span 
                  className="material-symbols-outlined text-2xl" 
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {isRestricted ? 'lock' : item.icon}
                </span>
              </div>
              <span className="font-headline font-semibold text-[11px] mt-1">{item.label}</span>
            </>
          );

          if (isRestricted) {
            return (
              <button 
                key={item.path}
                onClick={handleRestrictedClick}
                className="flex flex-col items-center justify-center p-3 text-gray-300 cursor-not-allowed opacity-60"
              >
                {Content}
              </button>
            );
          }

          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex flex-col items-center justify-center p-3 transition-all hover:scale-110 ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`}
            >
              {Content}
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
