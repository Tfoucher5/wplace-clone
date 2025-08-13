'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface HeaderProps {
  onAuthClick: () => void;
  totalPixels?: number;
  connectedUsers?: number;
}

const Header: React.FC<HeaderProps> = ({ onAuthClick, totalPixels = 0, connectedUsers = 1 }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header style={{
      backgroundColor: '#1e293b',
      borderBottom: '1px solid #475569',
      padding: '8px 16px',
      zIndex: 1000,
      position: 'relative'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '100%'
      }}>

        {/* Logo et titre - Compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '0 0 auto' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>W</span>
          </div>
          <div>
            <h1 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              lineHeight: '1.2'
            }}>
              WPlace Clone
            </h1>
            <p style={{
              fontSize: '10px',
              color: '#94a3b8',
              margin: 0,
              lineHeight: '1.2'
            }}>
              Pixel art collaboratif
            </p>
          </div>
        </div>

        {/* Statistiques globales - Très compact */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          flex: '1 1 auto',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center', display: window.innerWidth <= 768 ? 'none' : 'block' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{totalPixels.toLocaleString()}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>Pixels</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{connectedUsers}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>En ligne</div>
          </div>
          <div style={{ textAlign: 'center', display: window.innerWidth <= 768 ? 'none' : 'block' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>∞</div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>Mondial</div>
          </div>
        </div>

        {/* Menu utilisateur - Compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
          {isAuthenticated && user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#475569',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#475569'}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span style={{
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: window.innerWidth <= 768 ? 'none' : 'block'
                }}>
                  {user.username}
                </span>
                <svg width="12" height="12" fill="currentColor" style={{ color: '#94a3b8' }}>
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Menu déroulant */}
              {showUserMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '4px',
                  width: '180px',
                  backgroundColor: '#475569',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                  border: '1px solid #64748b',
                  zIndex: 1001
                }}>
                  <div style={{
                    padding: '12px',
                    borderBottom: '1px solid #64748b'
                  }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: 'white', margin: 0 }}>{user.username}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{user.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      // Ouvrir modal de profil
                      alert(`👤 Profil de ${user.username}\n\n📧 Email: ${user.email}\n🆔 ID: ${user.id}\n🎨 Pixels placés: Voir statistiques`);
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#e2e8f0',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    👤 Mon profil
                  </button>

                  <button
                    onClick={() => {
                      // Ouvrir modal des statistiques
                      const pixels = localStorage.getItem('wplace_pixels');
                      const userPixels = pixels ? JSON.parse(pixels).filter((p: any) => p.username === user.username) : [];

                      alert(`📊 Statistiques de ${user.username}\n\n🎯 Pixels placés: ${userPixels.length}\n🕒 Dernier pixel: ${userPixels.length > 0 ? new Date(userPixels[userPixels.length - 1].placedAt).toLocaleString() : 'Aucun'}\n🌍 Couverture: Monde entier\n🏆 Rang: Artiste actif`);
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#e2e8f0',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    📊 Mes statistiques
                  </button>

                  <div style={{ height: '1px', backgroundColor: '#64748b', margin: '4px 0' }}></div>

                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: '14px',
                      color: '#f87171',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    🚪 Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              Se connecter
            </button>
          )}

          {/* Bouton d'aide - Compact */}
          <button
            onClick={() => {
              alert('🎮 Comment jouer:\n\n1. 🎨 Sélectionnez une couleur\n2. 🖱️ Cliquez sur la carte\n3. ⏱️ Attendez 30 secondes\n4. 🎯 Recommencez !');
            }}
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: '#475569',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#64748b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#475569'}
            title="Aide"
          >
            <svg width="16" height="16" fill="currentColor" style={{ color: '#94a3b8' }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;