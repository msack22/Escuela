import React, { useState, useEffect, useCallback } from 'react';

// Interfaces para TypeScript
interface ScrapingAlert {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  auto_close: boolean;
  auto_close_seconds: number;
  persistent: boolean;
  metadata: any;
  ui_config: {
    color: string;
    bg_color: string;
    border_color: string;
    icon: string;
    show_progress: boolean;
  };
}

interface ScrapingStatus {
  status: string;
  progress?: {
    current_step: string;
    total_steps: number;
    current_step_index: number;
    percentage: number;
    items_found: number;
    items_processed: number;
    elapsed_time: number;
  };
  active_alerts: ScrapingAlert[];
}

// Componente de alerta individual
const ScrapingAlertItem = ({ alert, onDismiss }: { alert: ScrapingAlert; onDismiss: (id: string) => void }) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const [progress, setProgress] = React.useState(0);
  
  const uiConfig = alert.ui_config;
  const autoCloseTimeout = alert.auto_close_seconds * 1000;
  
  // Auto-cierre
  React.useEffect(() => {
    if (alert.auto_close && !alert.persistent && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(alert.id), 300);
      }, autoCloseTimeout);
      
      // Animación de progreso
      if (uiConfig.show_progress) {
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            const newProgress = prev + (100 / (autoCloseTimeout / 100));
            return newProgress >= 100 ? 100 : newProgress;
          });
        }, 100);
        
        return () => clearInterval(progressInterval);
      }
    }
  }, [alert.auto_close, alert.persistent, alert.id, autoCloseTimeout, uiConfig.show_progress, onDismiss]);
  
  if (!isVisible) return null;
  
  return (
    <div
      className="relative p-4 rounded-lg shadow-lg border-2 transition-all duration-300 transform"
      style={{
        backgroundColor: uiConfig.bg_color,
        borderColor: uiConfig.border_color,
        color: uiConfig.color,
        maxWidth: '400px'
      }}
    >
      {/* Botón de cerrar */}
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onDismiss(alert.id), 300);
        }}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
        style={{ color: uiConfig.color }}
      >
        ✕
      </button>
      
      {/* Icono y título */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{uiConfig.icon}</span>
        <h3 className="font-semibold text-lg">{alert.title}</h3>
      </div>
      
      {/* Mensaje */}
      <p className="text-sm mb-3 opacity-90">{alert.message}</p>
      
      {/* Barra de progreso para alertas de éxito */}
      {uiConfig.show_progress && (
        <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
          <div
            className="h-full transition-all duration-100 ease-linear rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: uiConfig.color
            }}
          />
        </div>
      )}
      
      {/* Metadata adicional */}
      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
        <div className="mt-2 text-xs opacity-75">
          {alert.metadata.task_id && (
            <div>Tarea: {alert.metadata.task_id}</div>
          )}
          {alert.metadata.total_contests !== undefined && (
            <div>Concursos: {alert.metadata.total_contests}</div>
          )}
          {alert.metadata.execution_time && (
            <div>Tiempo: {alert.metadata.execution_time.toFixed(2)}s</div>
          )}
        </div>
      )}
      
      {/* Timestamp */}
      <div className="mt-2 text-xs opacity-60">
        {new Date(alert.timestamp).toLocaleString()}
      </div>
    </div>
  );
};

// Componente principal de alertas
const ScrapingAlertsComponent = () => {
  const [alerts, setAlerts] = React.useState<ScrapingAlert[]>([]);
  const [status, setStatus] = React.useState<ScrapingStatus | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  
  // Simular conexión WebSocket (simplificado)
  useEffect(() => {
    // Simular estado inicial
    const fetchStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/scraping-async/status');
        const data = await response.json();
        if (data.success) {
          setStatus(data.data);
          setAlerts(data.data.active_alerts || []);
        }
      } catch (error) {
        console.error('Error obteniendo estado:', error);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000); // Actualizar cada 2 segundos
    
    return () => clearInterval(interval);
  }, []);
  
  // Función para cerrar alerta
  const handleDismissAlert = useCallback(async (alertId: string) => {
    try {
      await fetch(`http://localhost:8000/scraping-async/alerts/${alertId}`, {
        method: 'DELETE'
      });
      
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error cerrando alerta:', error);
    }
  }, []);
  
  // Función para cerrar todas las alertas
  const handleClearAllAlerts = useCallback(async () => {
    try {
      await fetch('http://localhost:8000/scraping-async/alerts', {
        method: 'DELETE'
      });
      
      setAlerts(prev => prev.filter(alert => alert.persistent));
    } catch (error) {
      console.error('Error cerrando alertas:', error);
    }
  }, []);
  
  // Función para iniciar scraping
  const handleStartScraping = useCallback(async (scraperType: string = 'modern') => {
    try {
      const response = await fetch('http://localhost:8000/scraping-async/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraper_type: scraperType,
          limit: 10
        })
      });
      
      const data = await response.json();
      console.log('Scraping iniciado:', data);
    } catch (error) {
      console.error('Error iniciando scraping:', error);
    }
  }, []);
  
  // Función para cancelar scraping
  const handleCancelScraping = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/scraping-async/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      console.log('Scraping cancelado:', data);
    } catch (error) {
      console.error('Error cancelando scraping:', error);
    }
  }, []);
  
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3" style={{ minWidth: '320px' }}>
      {/* Indicador de conexión */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm ${
        isConnected ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span>
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      
      {/* Controles de scraping */}
      <div className="bg-white border-2 border-gray-200 rounded-lg p-3 shadow-lg">
        <h4 className="font-semibold mb-2 text-gray-800">Control de Scraping</h4>
        
        <div className="space-y-2">
          <button
            onClick={() => handleStartScraping('modern')}
            disabled={status?.status === 'running'}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {status?.status === 'running' ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scraping en curso...
              </span>
            ) : (
              'Iniciar Scraping Moderno'
            )}
          </button>
          
          <button
            onClick={() => handleStartScraping('legacy')}
            disabled={status?.status === 'running'}
            className="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Iniciar Scraping Legacy
          </button>
          
          {status?.status === 'running' && (
            <button
              onClick={handleCancelScraping}
              className="w-full px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Cancelar Scraping
            </button>
          )}
        </div>
        
        {/* Barra de progreso */}
        {status?.progress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{status.progress.current_step}</span>
              <span>{status.progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${status.progress.percentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{status.progress.items_found} encontrados</span>
              <span>{status.progress.items_processed} procesados</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Alertas activas */}
      <div className="space-y-3">
        {alerts.length > 1 && (
          <button
            onClick={handleClearAllAlerts}
            className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
          >
            Cerrar todas las temporales
          </button>
        )}
        
        {alerts.map((alert, index) => (
          <ScrapingAlertItem
            key={alert.id}
            alert={alert}
            onDismiss={handleDismissAlert}
          />
        ))}
      </div>
    </div>
  );
};

export default ScrapingAlertsComponent;
