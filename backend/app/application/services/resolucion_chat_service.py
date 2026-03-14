"""
Servicio de Chat para Consultas de Resoluciones
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.domain.models.capacitacion_models import Resolucion, ConsultaResolucion

logger = logging.getLogger(__name__)


class ResolucionChatService:
    """Servicio para consultas sobre resoluciones educativas"""
    
    def __init__(self):
        self.embedding_cache = {}
        self.similarity_threshold = 0.3
    
    async def consultar_resolucion(self, db: Session, pregunta: str, session_id: str) -> Dict[str, Any]:
        """
        Realizar consulta sobre resoluciones y devolver respuesta relevante
        """
        try:
            # Registrar consulta
            consulta_registro = ConsultaResolucion(
                session_id=session_id,
                pregunta_usuario=pregunta,
                fecha_consulta=datetime.utcnow()
            )
            
            # Buscar resoluciones relevantes
            resoluciones_relevantes = await self._buscar_resoluciones_relevantes(db, pregunta)
            
            if not resoluciones_relevantes:
                respuesta = "No encontré información relevante sobre tu consulta. ¿Podrías reformular la pregunta o ser más específico?"
                consulta_registro.respuesta_generada = respuesta
                db.add(consulta_registro)
                db.commit()
                return {
                    "respuesta": respuesta,
                    "resoluciones_encontradas": [],
                    "sugerencias": await self._generar_sugerencias(db, pregunta)
                }
            
            # Generar respuesta basada en resoluciones encontradas
            mejor_resolucion = resoluciones_relevantes[0]
            respuesta = await self._generar_respuesta(pregunta, mejor_resolucion)
            
            # Guardar consulta
            consulta_registro.resolucion_id = mejor_resolucion.id
            consulta_registro.respuesta_generada = respuesta
            consulta_registro.fragmento_relevante = mejor_resolucion.resumen or mejor_resolucion.titulo
            db.add(consulta_registro)
            db.commit()
            
            return {
                "respuesta": respuesta,
                "resoluciones_encontradas": [
                    {
                        "id": r.id,
                        "numero": r.numero,
                        "titulo": r.titulo,
                        "resumen": r.resumen,
                        "anio": r.anio,
                        "organismo_emisor": r.organismo_emisor
                    }
                    for r in resoluciones_relevantes[:3]
                ],
                "resolucion_principal": {
                    "id": mejor_resolucion.id,
                    "numero": mejor_resolucion.numero,
                    "titulo": mejor_resolucion.titulo,
                    "texto_completo": mejor_resolucion.texto_completo,
                    "url_documento": mejor_resolucion.url_documento
                }
            }
        
        except Exception as e:
            logger.error(f"Error en consulta de resolución: {e}")
            return {
                "respuesta": "Ocurrió un error al procesar tu consulta. Por favor, intenta nuevamente.",
                "error": str(e)
            }
    
    async def _buscar_resoluciones_relevantes(self, db: Session, pregunta: str) -> List[Resolucion]:
        """
        Buscar resoluciones relevantes usando búsqueda de texto completo
        """
        try:
            # Extraer palabras clave de la pregunta
            palabras_clave = self._extraer_palabras_clave(pregunta)
            
            if not palabras_clave:
                return []
            
            # Construir consulta SQL
            query_conditions = []
            params = {}
            
            for i, palabra in enumerate(palabras_clave):
                condition = f"(LOWER(titulo) LIKE :palabra{i} OR LOWER(resumen) LIKE :palabra{i} OR LOWER(texto_completo) LIKE :palabra{i})"
                query_conditions.append(condition)
                params[f"palabra{i}"] = f"%{palabra.lower()}%"
            
            if query_conditions:
                sql_query = f"""
                SELECT * FROM resoluciones 
                WHERE ({' OR '.join(query_conditions)})
                AND activa = true
                ORDER BY 
                    CASE 
                        WHEN LOWER(titulo) LIKE :primera_palabra THEN 1
                        WHEN LOWER(resumen) LIKE :primera_palabra THEN 2
                        ELSE 3
                    END,
                    anio DESC
                LIMIT 10
                """
                params["primera_palabra"] = f"%{palabras_clave[0].lower()}%"
                
                result = db.execute(text(sql_query), params)
                return result.fetchall()
            
            return []
        
        except Exception as e:
            logger.error(f"Error buscando resoluciones relevantes: {e}")
            return []
    
    def _extraer_palabras_clave(self, texto: str) -> List[str]:
        """
        Extraer palabras clave relevantes del texto
        """
        # Palabras irrelevantes a filtrar
        stop_words = {
            'el', 'la', 'de', 'que', 'y', 'en', 'los', 'del', 'se', 'las', 'por', 'un', 
            'para', 'con', 'una', 'como', 'las', 'los', 'qué', 'cómo', 'cuándo', 'dónde',
            'es', 'son', 'fue', 'fueron', 'ser', 'está', 'están', 'han', 'ha', 'había',
            'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'nuestro', 'nuestra', 'nuestros', 'nuestras'
        }
        
        # Palabras clave educativas importantes
        palabras_educativas = {
            'concurso', 'concurso', 'oposicion', 'oposición', 'ascenso', 'carga', 'horas',
            'cargo', 'cargos', 'docente', 'docentes', 'profesor', 'profesores', 'director',
            'directivos', 'secundario', 'primario', 'inicial', 'superior', 'isfd', 'cge',
            'resolucion', 'resolución', 'reglamento', 'reglamento', 'salario', 'salarios',
            'puntaje', 'puntaje', 'meritos', 'antiguedad', 'antigüedad', 'titulo', 'titulos',
            'experiencia', 'experiencia', 'capacitacion', 'capacitación', 'curso', 'cursos'
        }
        
        # Procesar texto
        texto = texto.lower().replace('?', '').replace('¿', '').replace('!', '').replace('¡', '')
        palabras = texto.split()
        
        # Filtrar y extraer palabras clave
        palabras_clave = []
        for palabra in palabras:
            if (len(palabra) > 2 and 
                palabra not in stop_words and 
                (palabra in palabras_educativas or len(palabra) > 4)):
                palabras_clave.append(palabra)
        
        return palabras_clave[:5]  # Limitar a 5 palabras clave
    
    async def _generar_respuesta(self, pregunta: str, resolucion: Resolucion) -> str:
        """
        Generar respuesta basada en la resolución encontrada
        """
        pregunta_lower = pregunta.lower()
        
        # Respuestas específicas según tipo de pregunta
        if any(word in pregunta_lower for word in ['concurso', 'oposicion', 'ascenso']):
            return self._generar_respuesta_concursos(resolucion)
        
        elif any(word in pregunta_lower for word in ['reglamento', 'norma', 'disposicion']):
            return self._generar_respuesta_reglamento(resolucion)
        
        elif any(word in pregunta_lower for word in ['puntaje', 'merito', 'antiguedad']):
            return self._generar_respuesta_puntaje(resolucion)
        
        elif any(word in pregunta_lower for word in ['salario', 'remuneracion', 'haber']):
            return self._generar_respuesta_salario(resolucion)
        
        else:
            # Respuesta genérica
            return f"""
            Encontré información relevante en la Resolución {resolucion.numero} del año {resolucion.anio}:
            
            {resolucion.titulo}
            
            {resolucion.resumen or 'No hay resumen disponible.'}
            
            {'Documento completo: ' + resolucion.url_documento if resolucion.url_documento else ''}
            
            ¿Necesitas información específica sobre algún aspecto de esta resolución?
            """
    
    def _generar_respuesta_concursos(self, resolucion: Resolucion) -> str:
        """Generar respuesta para preguntas sobre concursos"""
        return f"""
        Según la Resolución {resolucion.numero} ({resolucion.anio}) sobre concursos:
        
        {resolucion.titulo}
        
        {resolucion.resumen or 'Esta resolución establece las normativas para concursos docentes en Entre Ríos.'}
        
        Puntos clave:
        • Define el procedimiento de concursos y oposiciones
        • Establece criterios de evaluación
        • Regula los requisitos para participantes
        
        {'Puedes consultar el documento completo en: ' + resolucion.url_documento if resolucion.url_documento else ''}
        
        ¿Te interesa algún aspecto específico del proceso de concursos?
        """
    
    def _generar_respuesta_reglamento(self, resolucion: Resolucion) -> str:
        """Generar respuesta para preguntas sobre reglamentos"""
        return f"""
        El reglamento principal está establecido en la Resolución {resolucion.numero} ({resolucion.anio}):
        
        {resolucion.titulo}
        
        {resolucion.resumen or 'Esta resolución contiene el reglamento general para el sistema educativo de Entre Ríos.'}
        
        Esta normativa rige:
        • Procedimientos administrativos
        • Derechos y obligaciones docentes
        • Normas de funcionamiento institucional
        
        {'Documento completo: ' + resolucion.url_documento if resolucion.url_documento else ''}
        
        ¿Qué aspecto específico del reglamento te interesa consultar?
        """
    
    def _generar_respuesta_puntaje(self, resolucion: Resolucion) -> str:
        """Generar respuesta para preguntas sobre puntaje"""
        return f"""
        Sobre el sistema de puntaje, la Resolución {resolucion.numero} ({resolucion.anio}) establece:
        
        {resolucion.titulo}
        
        {resolucion.resumen or 'Esta resolución define el sistema de puntaje para concursos docentes.'}
        
        El puntaje generalmente se compone de:
        • Títulos y antecedentes académicos
        • Antigüedad en la docencia
        • Experiencia docente
        • Publicaciones y capacitaciones
        • Méritos adicionales
        
        {'Consulta el documento completo para detalles específicos: ' + resolucion.url_documento if resolucion.url_documento else ''}
        
        ¿Necesitas saber cómo se calcula algún componente específico del puntaje?
        """
    
    def _generar_respuesta_salario(self, resolucion: Resolucion) -> str:
        """Generar respuesta para preguntas sobre salarios"""
        return f"""
        En cuanto a salarios y remuneraciones, la Resolución {resolucion.numero} ({resolucion.anio}) establece:
        
        {resolucion.titulo}
        
        {resolucion.resumen or 'Esta resolución define las escalas salariales y condiciones remunerativas.'}
        
        Aspectos importantes:
        • Escalas salariales por cargo y antigüedad
        • Adicionales y bonificaciones
        • Actualizaciones periódicas
        • Condiciones de pago
        
        {'Para detalles específicos consulta: ' + resolucion.url_documento if resolucion.url_documento else ''}
        
        ¿Te interesa conocer la escala salarial para algún cargo específico?
        """
    
    async def _generar_sugerencias(self, db: Session, pregunta: str) -> List[str]:
        """Generar sugerencias de consultas relacionadas"""
        sugerencias = []
        
        # Sugerencias basadas en palabras clave encontradas
        palabras_clave = self._extraer_palabras_clave(pregunta)
        
        if 'concurso' in palabras_clave:
            sugerencias.extend([
                "¿Cómo es el proceso de concurso docente?",
                "¿Qué requisitos se necesitan para concursos?",
                "¿Cómo se calcula el puntaje en concursos?"
            ])
        
        if 'puntaje' in palabras_clave:
            sugerencias.extend([
                "¿Cuánto vale el título de profesor en el puntaje?",
                "¿Cómo se puntúa la antigüedad docente?",
                "¿Qué puntaje dan las capacitaciones?"
            ])
        
        if 'salario' in palabras_clave:
            sugerencias.extend([
                "¿Cuál es el salario de un profesor secundario?",
                "¿Cómo se actualizan los salarios docentes?",
                "¿Qué adicionales existen en el salario?"
            ])
        
        return sugerencias[:5]  # Limitar a 5 sugerencias
    
    async def calificar_consulta(self, db: Session, consulta_id: int, calificacion: int, feedback: str = None):
        """Calificar una consulta como útil o no"""
        try:
            consulta = db.query(ConsultaResolucion).filter(ConsultaResolucion.id == consulta_id).first()
            if consulta:
                consulta.utilidad_calificacion = calificacion
                consulta.feedback_usuario = feedback
                db.commit()
                return True
        except Exception as e:
            logger.error(f"Error calificando consulta: {e}")
        return False
    
    async def obtener_estadisticas_consultas(self, db: Session) -> Dict[str, Any]:
        """Obtener estadísticas de consultas realizadas"""
        try:
            total_consultas = db.query(ConsultaResolucion).count()
            
            # Consultas con calificación
            con_calificacion = db.query(ConsultaResolucion).filter(
                ConsultaResolucion.utilidad_calificacion.isnot(None)
            ).count()
            
            # Promedio de calificación
            if con_calificacion > 0:
                avg_calificacion = db.query(ConsultaResolucion.utilidad_calificacion).filter(
                    ConsultaResolucion.utilidad_calificacion.isnot(None)
                ).all()
                if avg_calificacion:
                    promedio = sum(cal[0] for cal in avg_calificacion) / len(avg_calificacion)
                else:
                    promedio = 0
            else:
                promedio = 0
            
            # Consultas por día (últimos 7 días)
            from datetime import timedelta
            fecha_limite = datetime.utcnow() - timedelta(days=7)
            consultas_recientes = db.query(ConsultaResolucion).filter(
                ConsultaResolucion.fecha_consulta >= fecha_limite
            ).count()
            
            return {
                "total_consultas": total_consultas,
                "consultas_con_calificacion": con_calificacion,
                "calificacion_promedio": round(promedio, 2),
                "consultas_ultimos_7_dias": consultas_recientes
            }
        
        except Exception as e:
            logger.error(f"Error obteniendo estadísticas: {e}")
            return {
                "total_consultas": 0,
                "consultas_con_calificacion": 0,
                "calificacion_promedio": 0,
                "consultas_ultimos_7_dias": 0
            }
