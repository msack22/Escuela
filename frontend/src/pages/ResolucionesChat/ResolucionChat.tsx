import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Paper,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Rating,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Send,
  SmartToy,
  Person,
  RateReview,
  ThumbUp,
  ThumbDown,
  Description,
  Search,
  Lightbulb,
  AttachMoney,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  consultaId?: number;
  resolucionesEncontradas?: Array<{
    id: number;
    numero: string;
    titulo: string;
    resumen?: string;
    anio: number;
    organismo_emisor?: string;
  }>;
  sugerencias?: string[];
}

interface ResolucionChatProps {
  sessionId: string;
}

const ResolucionChat: React.FC<ResolucionChatProps> = ({ sessionId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedConsultaId, setSelectedConsultaId] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/capacitaciones/resoluciones/consultar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pregunta: inputValue,
          session_id: sessionId || generateSessionId(),
        }),
      });

      const data = await response.json();

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: data.respuesta,
        timestamp: new Date(),
        consultaId: data.consulta_id,
        resolucionesEncontradas: data.resoluciones_encontradas || [],
        sugerencias: data.sugerencias || [],
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'Lo siento, ocurrió un error al procesar tu consulta. Por favor, intenta nuevamente.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const openRatingDialog = (consultaId: number) => {
    setSelectedConsultaId(consultaId);
    setRatingDialogOpen(true);
  };

  const submitRating = async () => {
    if (!selectedConsultaId) return;

    try {
      const response = await fetch('/api/capacitaciones/resoluciones/calificar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consulta_id: selectedConsultaId,
          calificacion: rating,
          feedback: feedback.trim() || undefined,
        }),
      });

      if (response.ok) {
        setRatingDialogOpen(false);
        setRating(0);
        setFeedback('');
        setSelectedConsultaId(null);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            maxWidth: '70%',
          }}
        >
          <Avatar
            sx={{
              bgcolor: isUser ? 'primary.main' : 'secondary.main',
              ml: isUser ? 1 : 0,
              mr: isUser ? 0 : 1,
            }}
          >
            {isUser ? <Person /> : <SmartToy />}
          </Avatar>
          <Paper
            sx={{
              p: 2,
              bgcolor: isUser ? 'primary.main' : 'grey.100',
              color: isUser ? 'white' : 'text.primary',
              borderRadius: 2,
              borderTopLeftRadius: isUser ? 2 : 0,
              borderTopRightRadius: isUser ? 0 : 2,
            }}
          >
            <Typography variant="body1">{message.content}</Typography>
            
            {/* Resoluciones encontradas */}
            {message.resolucionesEncontradas && message.resolucionesEncontradas.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Resoluciones relevantes:
                </Typography>
                {message.resolucionesEncontradas.map((resolucion, index) => (
                  <Card key={index} sx={{ mb: 1, bgcolor: 'background.paper' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="body2" fontWeight="bold">
                        Resolución {resolucion.numero} ({resolucion.anio})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {resolucion.titulo}
                      </Typography>
                      {resolucion.resumen && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                          {resolucion.resumen.substring(0, 100)}...
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}

            {/* Sugerencias */}
            {message.sugerencias && message.sugerencias.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  <Lightbulb sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  Sugerencias:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {message.sugerencias.map((sugerencia, index) => (
                    <Chip
                      key={index}
                      label={sugerencia}
                      size="small"
                      clickable
                      onClick={() => handleSuggestionClick(sugerencia)}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h5" component="h1" gutterBottom>
            Asistente de Resoluciones Educativas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta sobre resoluciones, reglamentos, concursos y normativas educativas de Entre Ríos.
          </Typography>
        </CardContent>
      </Card>

      {/* Messages Area */}
      <Paper
        sx={{
          flexGrow: 1,
          p: 2,
          overflow: 'auto',
          maxHeight: '500px',
          bgcolor: 'grey.50',
        }}
      >
        {messages.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
            }}
          >
            <SmartToy sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              ¡Hola! Soy tu asistente educativo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Puedo ayudarte a encontrar información sobre:
            </Typography>
            <List sx={{ textAlign: 'left', maxWidth: 400 }}>
              <ListItem>
                <ListItemIcon>
                  <Search />
                </ListItemIcon>
                <ListItemText primary="Concursos y oposiciones docentes" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <Description />
                </ListItemIcon>
                <ListItemText primary="Reglamentos y normativas" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <RateReview />
                </ListItemIcon>
                <ListItemText primary="Sistemas de puntaje y méritos" />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <AttachMoney />
                </ListItemIcon>
                <ListItemText primary="Escalas salariales y beneficios" />
              </ListItem>
            </List>
            <Alert severity="info" sx={{ mt: 2, maxWidth: 400 }}>
              <Typography variant="body2">
                Ejemplos: "¿Cómo funciona el concurso de ascenso?", "¿Qué puntaje da el título de profesor?", "¿Cuál es el reglamento de concursos?"
              </Typography>
            </Alert>
          </Box>
        ) : (
          <Box>
            {messages.map((message) => (
              <div key={message.id}>{renderMessage(message)}</div>
            ))}
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Paper>

      {/* Input Area */}
      <Card sx={{ mt: 2 }}>
        <CardContent sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              maxRows={3}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu consulta sobre resoluciones educativas..."
              variant="outlined"
              disabled={isLoading}
            />
            <Button
              variant="contained"
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              sx={{ px: 3 }}
            >
              <Send />
            </Button>
          </Box>
          
          {/* Rating buttons for bot messages */}
          {messages
            .filter(m => m.type === 'bot' && m.consultaId)
            .slice(-1)
            .map((message) => (
              <Box key={message.id} sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  ¿Fue útil esta respuesta?
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => openRatingDialog(message.consultaId!)}
                  color="primary"
                >
                  <ThumbUp fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => openRatingDialog(message.consultaId!)}
                  color="error"
                >
                  <ThumbDown fontSize="small" />
                </IconButton>
              </Box>
            ))}
        </CardContent>
      </Card>

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onClose={() => setRatingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Calificar Respuesta</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography>
              ¿Qué tan útil fue la respuesta que te proporcioné?
            </Typography>
            <Rating
              value={rating}
              onChange={(_, newValue) => setRating(newValue || 0)}
              size="large"
            />
            <TextField
              multiline
              rows={3}
              label="Comentarios adicionales (opcional)"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tu feedback nos ayuda a mejorar..."
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRatingDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={submitRating}
            variant="contained"
            disabled={rating === 0}
          >
            Enviar Calificación
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResolucionChat;
