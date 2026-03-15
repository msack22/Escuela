"""
Script para poblar la base de datos con materias por defecto
"""

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.domain.models.models import Subject

def create_default_subjects():
    """Crear materias por defecto si no existen"""
    db = SessionLocal()
    
    try:
        # Materias por defecto
        default_subjects = [
            {"name": "Matemática", "description": "Área de matemáticas y ciencias exactas"},
            {"name": "Lengua y Literatura", "description": "Área de lengua española y literatura"},
            {"name": "Historia", "description": "Área de historia y ciencias sociales"},
            {"name": "Geografía", "description": "Área de geografía y espacio geográfico"},
            {"name": "Ciencias Naturales", "description": "Área de ciencias naturales y biología"},
            {"name": "Biología", "description": "Área específica de biología"},
            {"name": "Física", "description": "Área de física y ciencias físicas"},
            {"name": "Química", "description": "Área de química"},
            {"name": "Educación Física", "description": "Área de educación física y deportes"},
            {"name": "Inglés", "description": "Área de idioma inglés"},
            {"name": "Francés", "description": "Área de idioma francés"},
            {"name": "Italiano", "description": "Área de idioma italiano"},
            {"name": "Portugués", "description": "Área de idioma portugués"},
            {"name": "Música", "description": "Área de educación musical"},
            {"name": "Artes Plásticas", "description": "Área de artes plásticas y visuales"},
            {"name": "Informática", "description": "Área de computación y tecnología"},
            {"name": "Filosofía", "description": "Área de filosofía y ética"},
            {"name": "Psicología", "description": "Área de psicología educativa"},
            {"name": "Sociología", "description": "Área de sociología"},
            {"name": "Economía", "description": "Área de economía y administración"},
            {"name": "Contabilidad", "description": "Área de contabilidad"},
            {"name": "Administración", "description": "Área de administración y gestión"},
            {"name": "Derecho", "description": "Área de derecho y legislación"},
            {"name": "Trabajo Práctico", "description": "Área de trabajo práctico y pasantías"},
            {"name": "Orientación Educativa", "description": "Área de orientación educativa y vocacional"},
            {"name": "Educación Primaria", "description": "Nivel educativo primario"},
            {"name": "Educación Secundaria", "description": "Nivel educativo secundario"},
            {"name": "Educación Inicial", "description": "Nivel educativo inicial/jardín"},
            {"name": "Educación Especial", "description": "Área de educación especial"},
            {"name": "Formación Docente", "description": "Área de formación y capacitación docente"},
            {"name": "Supervisor Educativo", "description": "Cargo de supervisor educativo"},
            {"name": "Director de Escuela", "description": "Cargo de dirección escolar"},
            {"name": "Secretario Escolar", "description": "Cargo de secretaría escolar"},
            {"name": "Preceptor", "description": "Cargo de preceptoría"},
            {"name": "Profesor de Apoyo", "description": "Cargo de profesor de apoyo"},
            {"name": "Bibliotecario", "description": "Cargo de bibliotecario escolar"},
            {"name": "Todos los Niveles", "description": "Aplicable a todos los niveles educativos"}
        ]
        
        # Verificar si ya existen materias
        existing_count = db.query(Subject).count()
        print(f"Materias existentes: {existing_count}")
        
        if existing_count == 0:
            # Crear todas las materias por defecto
            for subject_data in default_subjects:
                subject = Subject(
                    name=subject_data["name"],
                    description=subject_data["description"]
                )
                db.add(subject)
                print(f"✅ Creada materia: {subject_data['name']}")
            
            db.commit()
            print(f"✅ Se crearon {len(default_subjects)} materias por defecto")
        else:
            print("ℹ️  Ya existen materias en la base de datos")
            
            # Mostrar materias existentes
            existing_subjects = db.query(Subject).all()
            print("Materias existentes:")
            for subject in existing_subjects:
                print(f"  - {subject.name} (ID: {subject.id})")
    
    except Exception as e:
        print(f"❌ Error creando materias: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_subjects()
