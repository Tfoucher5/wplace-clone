// src/hooks/useWebSocket.ts

'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { Pixel } from '@/lib/database';

interface UseWebSocketProps {
  onPixelUpdated?: (pixel: Pixel, user: { id: number; username: string }) => void;
  onPixelsLoaded?: (pixels: Pixel[]) => void;
  onUserStatsUpdated?: (stats: any) => void;
}

export function useWebSocket({ 
  onPixelUpdated, 
  onPixelsLoaded, 
  onUserStatsUpdated 
}: UseWebSocketProps) {
  const { token, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Créer la connexion WebSocket
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || window.location.origin, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      retries: 3
    });

    socketRef.current = socket;

    // Événements de connexion
    socket.on('connect', () => {
      console.log('WebSocket connecté');
      setIsConnected(true);
      setConnectionError(null);
      
      // S'authentifier immédiatement
      socket.emit('authenticate', token);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket déconnecté');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Erreur de connexion WebSocket:', error);
      setConnectionError('Erreur de connexion au serveur temps réel');
      setIsConnected(false);
    });

    // Authentification
    socket.on('authenticated', (data) => {
      console.log('Authentifié sur WebSocket:', data.user.username);
    });

    socket.on('auth_error', (error) => {
      console.error('Erreur d\'authentification WebSocket:', error);
      setConnectionError('Erreur d\'authentification');
    });

    // Événements de pixels
    socket.on('pixel_updated', (data) => {
      if (onPixelUpdated) {
        onPixelUpdated(data.pixel, data.user);
      }
    });

    socket.on('pixels_loaded', (data) => {
      if (onPixelsLoaded) {
        onPixelsLoaded(data.pixels);
      }
    });

    socket.on('user_stats', (stats) => {
      if (onUserStatsUpdated) {
        onUserStatsUpdated(stats);
      }
    });

    // Ping pour maintenir la connexion
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      socket.disconnect();
    };
  }, [isAuthenticated, token, onPixelUpdated, onPixelsLoaded, onUserStatsUpdated]);

  // Fonctions pour interagir avec le WebSocket
  const updateView = (bounds: any, zoom: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('view_changed', { bounds, zoom });
    }
  };

  const placePixel = (lat: number, lng: number, color: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('place_pixel', { lat, lng, color });
    }
  };

  const requestUserStats = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_user_stats');
    }
  };

  return {
    isConnected,
    connectionError,
    updateView,
    placePixel,
    requestUserStats
  };
}