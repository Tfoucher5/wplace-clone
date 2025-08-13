// src/hooks/useWebSocket.ts

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

// Types pour les événements WebSocket
export interface WSPixel {
  id: number;
  lat: number;
  lng: number;
  gridX: number;
  gridY: number;
  color: string;
  username: string;
  placedAt: string;
}

export interface WSUserStats {
  id: number;
  username: string;
  pixelsPlaced: number;
  pixelsCurrent: number;
  allianceName?: string;
}

export interface WSEventHandlers {
  // Événements reçus du serveur
  'pixel_updated': (data: { pixel: WSPixel; user: { id: number; username: string } }) => void;
  'pixels_loaded': (data: { pixels: WSPixel[]; chunk?: { x: number; y: number } }) => void;
  'user_stats': (stats: WSUserStats) => void;
  'user_joined': (data: { user: { id: number; username: string }; totalUsers: number }) => void;
  'user_left': (data: { user: { id: number; username: string }; totalUsers: number }) => void;
  'alliance_created': (data: { alliance: any; creator: { id: number; username: string } }) => void;
  'alliance_joined': (data: { alliance: any; user: { id: number; username: string } }) => void;

  // Événements d'authentification
  'authenticated': (data: { user: any }) => void;
  'auth_error': (error: string) => void;

  // Événements de connexion
  'connect': () => void;
  'disconnect': () => void;
  'connect_error': (error: any) => void;
  'reconnect': (attemptNumber: number) => void;
  'reconnect_error': (error: any) => void;
  'reconnect_failed': () => void;
}

interface UseWebSocketProps {
  onPixelUpdated?: (pixel: WSPixel, user: { id: number; username: string }) => void;
  onPixelsLoaded?: (pixels: WSPixel[], chunk?: { x: number; y: number }) => void;
  onUserStatsUpdated?: (stats: WSUserStats) => void;
  onUserJoined?: (user: { id: number; username: string }, totalUsers: number) => void;
  onUserLeft?: (user: { id: number; username: string }, totalUsers: number) => void;
  autoConnect?: boolean;
}

export function useWebSocket({
  onPixelUpdated,
  onPixelsLoaded,
  onUserStatsUpdated,
  onUserJoined,
  onUserLeft,
  autoConnect = true
}: UseWebSocketProps = {}) {

  const { token, isAuthenticated, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Stockage des callbacks pour éviter les re-rendus
  const callbacksRef = useRef({
    onPixelUpdated,
    onPixelsLoaded,
    onUserStatsUpdated,
    onUserJoined,
    onUserLeft
  });

  // Mettre à jour les callbacks
  useEffect(() => {
    callbacksRef.current = {
      onPixelUpdated,
      onPixelsLoaded,
      onUserStatsUpdated,
      onUserJoined,
      onUserLeft
    };
  }, [onPixelUpdated, onPixelsLoaded, onUserStatsUpdated, onUserJoined, onUserLeft]);

  // État du WebSocket - utilisation d'une ref pour éviter les fuites mémoire
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration de reconnexion
  const RECONNECT_INTERVAL = 5000; // 5 secondes
  const MAX_RECONNECT_ATTEMPTS = 10;
  const HEARTBEAT_INTERVAL = 30000; // 30 secondes

  // Nettoyage des timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Démarrer le heartbeat
  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, [clearTimers]);

  // Gérer les messages WebSocket
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'pixel_updated':
          callbacksRef.current.onPixelUpdated?.(data.pixel, data.user);
          break;

        case 'pixels_loaded':
          callbacksRef.current.onPixelsLoaded?.(data.pixels, data.chunk);
          break;

        case 'user_stats':
          callbacksRef.current.onUserStatsUpdated?.(data.stats);
          break;

        case 'user_joined':
          callbacksRef.current.onUserJoined?.(data.user, data.totalUsers);
          break;

        case 'user_left':
          callbacksRef.current.onUserLeft?.(data.user, data.totalUsers);
          break;

        case 'authenticated':
          console.log('🔐 WebSocket authentifié:', data.user.username);
          setConnectionError(null);
          break;

        case 'auth_error':
          console.error('❌ Erreur auth WebSocket:', data.error);
          setConnectionError('Erreur d\'authentification');
          break;

        case 'pong':
          // Réponse au ping - connexion active
          break;

        default:
          console.log('📨 Message WebSocket inconnu:', data.type);
      }
    } catch (error) {
      console.error('❌ Erreur parsing message WebSocket:', error);
    }
  }, []);

  // Se connecter au WebSocket
  const connect = useCallback(() => {
    if (!autoConnect || !isAuthenticated || !token) {
      return;
    }

    // Éviter les connexions multiples
    if (wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔌 Connexion WebSocket...');

    // Construire l'URL WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connecté');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
        setIsReconnecting(false);

        // S'authentifier immédiatement
        ws.send(JSON.stringify({
          type: 'authenticate',
          token: token
        }));

        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('🔌 WebSocket fermé:', event.code, event.reason);
        setIsConnected(false);
        clearTimers();

        // Tentative de reconnexion automatique si ce n'est pas volontaire
        if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          setIsReconnecting(true);
          setReconnectAttempts(prev => prev + 1);

          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Tentative de reconnexion ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);
            connect();
          }, RECONNECT_INTERVAL);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Impossible de se reconnecter au serveur');
          setIsReconnecting(false);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        setConnectionError('Erreur de connexion temps réel');
      };

    } catch (error) {
      console.error('❌ Erreur création WebSocket:', error);
      setConnectionError('Impossible de créer la connexion');
    }
  }, [autoConnect, isAuthenticated, token, reconnectAttempts, handleMessage, startHeartbeat, clearTimers]);

  // Se déconnecter du WebSocket
  const disconnect = useCallback(() => {
    console.log('🔌 Déconnexion WebSocket...');

    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'Déconnexion volontaire');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectAttempts(0);
    setConnectionError(null);
  }, [clearTimers]);

  // Envoyer un message
  const sendMessage = useCallback((type: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type,
        ...data
      }));
      return true;
    } else {
      console.warn('⚠️ WebSocket non connecté, impossible d\'envoyer:', type);
      return false;
    }
  }, []);

  // Fonctions spécialisées pour l'envoi de messages
  const requestPixels = useCallback((chunkX: number, chunkY: number) => {
    return sendMessage('request_pixels', { chunkX, chunkY });
  }, [sendMessage]);

  const requestStats = useCallback(() => {
    return sendMessage('request_stats');
  }, [sendMessage]);

  const joinAlliance = useCallback((allianceId: number) => {
    return sendMessage('join_alliance', { allianceId });
  }, [sendMessage]);

  const leaveAlliance = useCallback(() => {
    return sendMessage('leave_alliance');
  }, [sendMessage]);

  // Effet pour gérer la connexion/déconnexion automatique
  useEffect(() => {
    if (autoConnect && isAuthenticated && token) {
      connect();
    } else if (!isAuthenticated) {
      disconnect();
    }

    // Nettoyage à la déconnexion du composant
    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, token]); // Ne pas inclure connect/disconnect pour éviter les boucles

  // Nettoyage final
  useEffect(() => {
    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearTimers]);

  return {
    // État de la connexion
    isConnected,
    isReconnecting,
    connectionError,
    reconnectAttempts,

    // Contrôles de connexion
    connect,
    disconnect,

    // Envoi de messages
    sendMessage,
    requestPixels,
    requestStats,
    joinAlliance,
    leaveAlliance,

    // Informations utilisateur
    connectedUser: user,
  };
}

// Hook simplifié pour usage sans serveur WebSocket (mode démo)
export function useWebSocketDemo({
  onPixelUpdated,
  onPixelsLoaded,
  onUserStatsUpdated,
}: UseWebSocketProps = {}) {

  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated } = useAuth();

  // Simuler la connexion
  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔌 WebSocket démo connecté');
      setIsConnected(true);

      // Simuler le chargement de pixels
      setTimeout(() => {
        onPixelsLoaded?.([]);
      }, 1000);
    } else {
      setIsConnected(false);
    }
  }, [isAuthenticated, onPixelsLoaded]);

  const sendMessage = useCallback((type: string, data?: any) => {
    console.log('📨 WebSocket démo - envoi:', type, data);
    return true;
  }, []);

  return {
    isConnected,
    isReconnecting: false,
    connectionError: null,
    reconnectAttempts: 0,
    connect: () => { },
    disconnect: () => { },
    sendMessage,
    requestPixels: () => true,
    requestStats: () => true,
    joinAlliance: () => true,
    leaveAlliance: () => true,
    connectedUser: null,
  };
}

// Types d'export pour TypeScript
export type { UseWebSocketProps };