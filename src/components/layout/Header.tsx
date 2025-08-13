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
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{totalPixels.toLocaleString()}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>Pixels</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{connectedUsers}</div>
            <div style={{ color: '#94a3b8', fontSize: '10px' }}>En ligne</div>
          </div>
        </div>

        {/* Zone utilisateur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
          {isAuthenticated ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {user?.username.charAt(0).toUpperCase()}
                </div>
                <span>{user?.username}</span>
                <span style={{ fontSize: '10px' }}>▼</span>
              </button>

              {/* Menu déroulant */}
              {showUserMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '8px',
                  minWidth: '200px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                  zIndex: 1100
                }}>
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    color: '#94a3b8',
                    borderBottom: '1px solid #475569',
                    marginBottom: '8px'
                  }}>
                    <div style={{ color: 'white', fontWeight: '600' }}>{user?.email}</div>
                    <div>Pixels placés: {user?.pixelsPlaced || 0}</div>
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
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
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }}
            >
              🔐 Connexion
            </button>
          )}
        </div>
      </div>

      {/* Fermer le menu si on clique ailleurs */}
      {showUserMenu && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000
          }}
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default Header;