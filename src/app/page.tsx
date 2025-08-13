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
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '2px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: 'white', fontSize: '16px' }}>Chargement de la carte...</p>
          <p style={{ color: '#94a3b8', fontSize: '12px' }}>
            Initialisation des composants Leaflet
          </p>
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        onAuthClick={() => setIsAuthModalOpen(true)}
        totalPixels={totalPixels}
        connectedUsers={connectedUsers}
      />

      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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

      {/* Styles globaux pour les animations */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #0f172a;
        }

        #__next {
          height: 100%;
        }

        * {
          box-sizing: border-box;
        }

        /* Leaflet custom styles */
        .leaflet-container {
          background-color: #1e293b !important;
        }

        .leaflet-control-zoom a {
          background-color: #374151 !important;
          color: white !important;
          border-color: #4b5563 !important;
        }

        .leaflet-control-zoom a:hover {
          background-color: #4b5563 !important;
        }

        .leaflet-popup-content-wrapper {
          background-color: #1e293b !important;
          color: white !important;
        }

        .leaflet-popup-tip {
          background-color: #1e293b !important;
        }
      `}</style>
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