'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    login: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let result;

      if (isLogin) {
        result = await login(formData.login, formData.password);
      } else {
        result = await register(formData.username, formData.email, formData.password);
      }

      if (result.success) {
        onClose();
        setFormData({ username: '', email: '', password: '', login: '' });
        console.log('✅ Authentification réussie !');
      } else {
        setError(result.error || 'Une erreur est survenue');
      }
    } catch (error) {
      setError('Erreur de connexion au serveur');
      console.error('Erreur auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleClose = () => {
    setFormData({ username: '', email: '', password: '', login: '' });
    setError('');
    setIsLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '12px',
        padding: '24px',
        width: '100%',
        maxWidth: '400px',
        border: '1px solid #475569',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'white',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {isLogin ? '🔐 Connexion' : '📝 Inscription'}
          </h2>
          <button
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            ✕
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Nom d'utilisateur (inscription seulement) */}
          {!isLogin && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                marginBottom: '6px'
              }}>
                👤 Nom d'utilisateur
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#475569',
                  border: '1px solid #64748b',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#64748b'}
                required
                minLength={3}
                maxLength={20}
                placeholder="Votre nom d'utilisateur"
              />
            </div>
          )}

          {/* Email (inscription seulement) */}
          {!isLogin && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                marginBottom: '6px'
              }}>
                📧 Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#475569',
                  border: '1px solid #64748b',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#64748b'}
                required
                placeholder="votre@email.com"
              />
            </div>
          )}

          {/* Login (connexion seulement) */}
          {isLogin && (
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                marginBottom: '6px'
              }}>
                👤 Nom d'utilisateur ou Email
              </label>
              <input
                type="text"
                name="login"
                value={formData.login}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#475569',
                  border: '1px solid #64748b',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#64748b'}
                required
                placeholder="Nom d'utilisateur ou email"
              />
            </div>
          )}

          {/* Mot de passe */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              marginBottom: '6px'
            }}>
              🔒 Mot de passe
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#475569',
                border: '1px solid #64748b',
                borderRadius: '8px',
                color: 'white',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#64748b'}
              required
              minLength={6}
              placeholder="Votre mot de passe"
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Bouton de soumission */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: isLoading ? '#64748b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
            onMouseLeave={(e) => {
              if (!isLoading) e.currentTarget.style.backgroundColor = '#3b82f6';
            }}
          >
            {isLoading && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            )}
            {isLoading
              ? (isLogin ? 'Connexion...' : 'Inscription...')
              : (isLogin ? '🚀 Se connecter' : '📝 S\'inscrire')
            }
          </button>
        </form>

        {/* Basculer entre connexion/inscription */}
        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          paddingTop: '20px',
          borderTop: '1px solid #475569'
        }}>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ username: '', email: '', password: '', login: '' });
            }}
            style={{
              backgroundColor: 'transparent',
              color: '#3b82f6',
              border: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
          >
            {isLogin
              ? '📝 Pas encore de compte ? S\'inscrire'
              : '🔐 Déjà un compte ? Se connecter'
            }
          </button>
        </div>

        {/* Mode test */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#6ee7b7'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🧪 Mode Test:</div>
          <div>• Créez un compte avec n'importe quel email</div>
          <div>• Les données sont temporaires (pas de vraie BDD)</div>
          <div>• Fonctionnel pour tester l'interface !</div>
        </div>
      </div>

      {/* Styles pour l'animation de chargement */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthModal;