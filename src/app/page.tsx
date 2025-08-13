'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Header from '@/components/layout/Header';
import AuthModal from '@/components/auth/authModal';

// Import dynamique pour éviter les erreurs SSR avec Leaflet
const LeafletMapDynamic = dynamic(
  () => import('@/components/map/LeafletMapDynamic'),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Chargement de la carte...</p>
        </div>
      </div>
    )
  }
);

// Composant intérieur qui utilise useAuth
function AppContent() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [totalPixels, setTotalPixels] = useState(0);
  const [connectedUsers, setConnectedUsers] = useState(1);
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="h-full flex flex-col">
      <Header
        onAuthClick={() => setIsAuthModalOpen(true)}
        totalPixels={totalPixels}
        connectedUsers={connectedUsers}
      />

      <main className="flex-1">
        <LeafletMapDynamic
          userId={user?.id}
          isAuthenticated={isAuthenticated}
          onPixelPlaced={(count) => setTotalPixels(count)}
        />
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}