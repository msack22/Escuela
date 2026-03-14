from typing import List, Optional, Dict
from datetime import datetime, time
from dataclasses import dataclass
import json
import os

try:
    from googleapiclient.discovery import build
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.errors import HttpError
    GOOGLE_CALENDAR_AVAILABLE = True
except ImportError:
    GOOGLE_CALENDAR_AVAILABLE = False
    print("Google Calendar API no disponible. Instala con: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("Pandas no disponible. Instala con: pip install pandas openpy")


@dataclass
class ScheduleConflict:
    """Representa un conflicto de horarios"""
    contest_title: str
    contest_date: datetime
    contest_schedule: str
    contest_hours: int
    user_schedule: str
    user_hours: int
    conflict_type: str  # 'solapamiento', 'conflicto_parcial', 'excede_horas'


class CalendarManager:
    """Gestor de calendarios para sincronización con concursos"""
    
    def __init__(self, credentials_path: str = "calendar_credentials.json"):
        self.credentials_path = credentials_path
        self.service = None
        self.calendar_id = None
        self._initialize_google_calendar()
    
    def _initialize_google_calendar(self):
        """Inicializar servicio de Google Calendar"""
        if not GOOGLE_CALENDAR_AVAILABLE:
            return False
        
        # Configuración OAuth2
        SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']
        CLIENT_SECRETS_FILE = 'client_secret.json'
        
        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRETS_FILE,
                scopes=SCOPES
            )
            
            creds = None
            if os.path.exists(self.credentials_path):
                creds = Credentials.from_authorized_user_file(
                    self.credentials_path, SCOPES)
            
            if not creds or not creds.valid:
                if flow:
                    auth_url, _ = flow.authorization_url(prompt='consent')
                    print(f"Por favor visita esta URL para autorizar el acceso a Google Calendar:")
                    print(f"{auth_url}")
                    print(f"Luego ingresa el código de autorización y ejecuta este script nuevamente.")
                    return False
                
                creds = flow.run_local_server(port=0)
            
            self.service = build('calendar', 'v3', credentials=creds)
            return True
            
        except Exception as e:
            print(f"Error inicializando Google Calendar: {e}")
            return False
    
    def export_schedule_to_csv(self, schedule: List[Dict], filename: str = "my_schedule.csv"):
        """Exportar horario a formato CSV"""
        if not PANDAS_AVAILABLE:
            print("Pandas no disponible para exportar a CSV")
            return False
        
        try:
            df = pd.DataFrame(schedule)
            df.to_csv(filename, index=False)
            print(f"Horario exportado a {filename}")
            return True
        except Exception as e:
            print(f"Error exportando a CSV: {e}")
            return False
    
    def import_schedule_from_csv(self, filename: str = "my_schedule.csv") -> List[Dict]:
        """Importar horario desde formato CSV"""
        if not PANDAS_AVAILABLE:
            print("Pandas no disponible para importar desde CSV")
            return []
        
        try:
            df = pd.read_csv(filename)
            schedule = df.to_dict('records')
            print(f"Horario importado desde {filename}")
            return schedule
        except Exception as e:
            print(f"Error importando desde CSV: {e}")
            return []
    
    def analyze_conflicts(self, user_schedule: List[Dict], contests: List[Dict]) -> List[ScheduleConflict]:
        """Analizar conflictos entre horario del usuario y concursos"""
        conflicts = []
        
        for contest in contests:
            contest_date = datetime.fromisoformat(contest['date'].replace('Z', '+00:00'))
            contest_schedule = contest.get('schedule', '')
            contest_hours = contest.get('hours_to_cover', 0)
            
            # Analizar cada día del horario del usuario
            for user_day in user_schedule:
                user_date = datetime.fromisoformat(user_day['date'].replace('Z', '+00:00'))
                
                # Solo analizar si es el mismo día o cercano
                if abs((user_date - contest_date).days) <= 1:
                    user_schedule_str = user_day.get('schedule', '')
                    user_hours = self._calculate_daily_hours(user_schedule_str)
                    
                    conflict = self._analyze_schedule_conflict(
                        user_schedule_str, user_hours,
                        contest_schedule, contest_hours
                    )
                    
                    if conflict:
                        conflicts.append(ScheduleConflict(
                            contest_title=contest['title'],
                            contest_date=contest_date,
                            contest_schedule=contest_schedule,
                            contest_hours=contest_hours,
                            user_schedule=user_schedule_str,
                            user_hours=user_hours,
                            conflict_type=conflict
                        ))
        
        return conflicts
    
    def _calculate_daily_hours(self, schedule_str: str) -> int:
        """Calcular horas totales de un día basado en el horario"""
        if not schedule_str:
            return 0
        
        # Patrones para extraer horas
        patterns = [
            r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})',
            r'(\d{1,2})\s*-\s*(\d{1,2})\s*a\s*m\.?\s*\d{1,2}:\d{2})',
            r'(\d{1,2})\s*hs\s*a\s*\d{1,2})\s*hs'
        ]
        
        total_hours = 0
        for pattern in patterns:
            matches = re.findall(pattern, schedule_str.lower())
            for match in matches:
                try:
                    start_time = time.strptime(match.group(1), '%H:%M')
                    end_time = time.strptime(match.group(2), '%H:%M')
                    if start_time and end_time:
                        hours = (end_time.hour - start_time.hour) + (end_time.minute - start_time.minute) / 60
                        total_hours += hours
                except ValueError:
                    continue
        
        return total_hours
    
    def _analyze_schedule_conflict(self, user_schedule: str, user_hours: int, 
                               contest_schedule: str, contest_hours: int) -> Optional[str]:
        """Analizar conflicto específico entre dos horarios"""
        if not user_schedule or not contest_schedule:
            return None
        
        # Extraer horarios del concurso
        contest_times = self._extract_time_ranges(contest_schedule)
        user_times = self._extract_time_ranges(user_schedule)
        
        # Verificar solapamiento
        for contest_start, contest_end in contest_times:
            for user_start, user_end in user_times:
                if (user_start <= contest_end and user_end >= contest_start) or \
                   (user_start <= contest_start and user_end > contest_start):
                    return 'solapamiento'
        
        # Verificar si excede el límite de horas
        total_user_hours = user_hours
        total_contest_hours = contest_hours
        
        if total_user_hours + total_contest_hours > 24:  # Más de 24 horas en un día
            return 'excede_horas'
        
        # Verificar conflicto parcial
        if contest_times and user_times:
            for contest_start, contest_end in contest_times:
                for user_start, user_end in user_times:
                    if (user_start < contest_end and user_end > contest_start) or \
                       (user_start > contest_start and user_end <= contest_end):
                        return 'conflicto_parcial'
        
        return None
    
    def _extract_time_ranges(self, schedule_str: str) -> List[tuple]:
        """Extraer rangos de tiempo de un string de horario"""
        if not schedule_str:
            return []
        
        patterns = [
            r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})',
            r'(\d{1,2})\s*-\s*(\d{1,2})\s*a\s*m\.?\s*\d{1,2}:\d{2})',
            r'(\d{1,2})\s*hs\s*a\s*\d{1,2})\s*hs'
        ]
        
        time_ranges = []
        for pattern in patterns:
            matches = re.findall(pattern, schedule_str.lower())
            for match in matches:
                try:
                    start_time = time.strptime(match.group(1), '%H:%M')
                    end_time = time.strptime(match.group(2), '%H:%M')
                    time_ranges.append((start_time, end_time))
                except ValueError:
                    continue
        
        return time_ranges
    
    def generate_conflict_report(self, conflicts: List[ScheduleConflict]) -> str:
        """Generar reporte de conflictos"""
        if not conflicts:
            return "✅ No se detectaron conflictos de horarios"
        
        report = "⚠️ **Reporte de Conflictos de Horarios**\\n\\n"
        
        for i, conflict in enumerate(conflicts, 1):
            report += f"**{i}. {conflict.contest_title}\\n"
            report += f"   📅 Fecha: {conflict.contest_date.strftime('%d/%m/%Y')}\\n"
            report += f"   🕐 Horario concurso: {conflict.contest_schedule}\\n"
            report += f"   📊 Horas requeridas: {conflict.contest_hours}\\n"
            report += f"   🕐 Tu horario: {conflict.user_schedule}\\n"
            report += f"   📊 Tus horas: {conflict.user_hours}\\n"
            report += f"   ⚠️ Tipo: {conflict.conflict_type.replace('_', ' ').title()}\\n\\n"
        
        return report
    
    def suggest_optimizations(self, conflicts: List[ScheduleConflict]) -> List[str]:
        """Sugerir optimizaciones basadas en los conflictos"""
        suggestions = []
        
        if conflicts:
            # Sugerir priorización
            suggestions.append("🎯 **Priorización**: Considera postularte primero a los concursos con mejores condiciones o mayor relevancia.")
            
            # Sugerir redistribución de horarios
            suggestions.append("⏰ **Gestión de tiempo**: Si tienes múltiples conflictos, considera redistribuir tus horarios para cubrir más concursos.")
            
            # Sugerir flexibilidad
            suggestions.append("🔄 **Flexibilidad**: Algunos concursos pueden tener horarios flexibles o permitir ajustes.")
            
            # Sugerir comunicación
            suggestions.append("📞 **Comunicación**: Contacta a las escuelas para conocer si hay flexibilidad en los horarios.")
        
        return suggestions


def main():
    """Función principal para demostración"""
    print("🗓️ **Gestor de Calendarios y Concursos**\\n")
    
    if not GOOGLE_CALENDAR_AVAILABLE:
        print("❌ Google Calendar API no está disponible.")
        print("Por favor instala las dependencias:")
        print("pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
        return
    
    manager = CalendarManager()
    
    if not manager.service:
        print("❌ No se pudo inicializar Google Calendar. Revisa la configuración de autenticación.")
        return
    
    # Ejemplo de uso
    print("\\n📋 **Ejemplo de uso:**")
    print("1. Exporta tu horario actual a CSV:")
    print("   python -m app.infrastructure.calendar_manager export")
    print("\\n2. Analiza conflictos con concursos:")
    print("   python -m app.infrastructure.calendar_manager analyze")
    print("\\n3. Sincroniza con Google Calendar:")
    print("   python -m app.infrastructure.calendar_manager sync")


if __name__ == "__main__":
    main()
