from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db

router = APIRouter()

# Pydantic models simples
class UserBase(BaseModel):
    username: str
    email: str
    phone_number: str
    is_active: bool = True

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    alert_count: Optional[int] = 0

class AlertResponse(BaseModel):
    id: int
    user_name: str
    whatsapp_number: str
    subject_preferences: List[str]
    max_distance_km: int
    created_at: datetime
    is_active: bool

class ContestNotificationResponse(BaseModel):
    id: int
    user_id: int
    contest_id: int
    contest_title: str
    school_name: str
    subject_name: str
    sent_at: datetime
    contest_date: str

@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all users"""
    try:
        # Query simple sin usar modelos ORM complejos
        result = db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone_number, u.is_active, u.created_at,
                   COUNT(a.id) as alert_count
            FROM users u
            LEFT JOIN alerts a ON u.id = a.user_id
            GROUP BY u.id, u.name, u.email, u.phone_number, u.is_active, u.created_at
            LIMIT :limit OFFSET :skip
        """), {"limit": limit, "skip": skip})
        
        users = []
        for row in result:
            user_data = {
                "id": row[0],
                "username": row[1],
                "email": row[2],
                "phone_number": row[3] or "",
                "is_active": row[4],
                "created_at": row[5],
                "alert_count": row[6] or 0
            }
            users.append(UserResponse(**user_data))
        
        return users
    except Exception as e:
        # Si la tabla no existe, devolver lista vacía
        if "doesn't exist" in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    try:
        result = db.execute(text("""
            SELECT u.id, u.name, u.email, u.phone_number, u.is_active, u.created_at,
                   COUNT(a.id) as alert_count
            FROM users u
            LEFT JOIN alerts a ON u.id = a.user_id
            WHERE u.id = :user_id
            GROUP BY u.id, u.name, u.email, u.phone_number, u.is_active, u.created_at
        """), {"user_id": user_id})
        
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_data = {
            "id": row[0],
            "username": row[1],
            "email": row[2],
            "phone_number": row[3] or "",
            "is_active": row[4],
            "created_at": row[5],
            "alert_count": row[6] or 0
        }
        return UserResponse(**user_data)
    except Exception as e:
        if "doesn't exist" in str(e):
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create new user"""
    try:
        # Check if email already exists
        result = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": user.email})
        if result.first():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        result = db.execute(text("""
            INSERT INTO users (name, email, phone_number, is_active, created_at)
            VALUES (:name, :email, :phone_number, :is_active, NOW())
        """), {
            "name": user.username,
            "email": user.email,
            "phone_number": user.phone_number,
            "is_active": user.is_active
        })
        
        user_id = result.lastrowid
        db.commit()
        
        return UserResponse(
            id=user_id,
            username=user.username,
            email=user.email,
            phone_number=user.phone_number,
            is_active=user.is_active,
            created_at=datetime.now(),
            alert_count=0
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    """Update user"""
    try:
        # Check if user exists
        result = db.execute(text("SELECT id FROM users WHERE id = :user_id"), {"user_id": user_id})
        if not result.first():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Build update query dynamically
        update_fields = []
        params = {"user_id": user_id}
        
        if user_update.username is not None:
            update_fields.append("name = :username")
            params["username"] = user_update.username
        
        if user_update.email is not None:
            # Check if email already exists for another user
            result = db.execute(text("SELECT id FROM users WHERE email = :email AND id != :user_id"), 
                              {"email": user_update.email, "user_id": user_id})
            if result.first():
                raise HTTPException(status_code=400, detail="Email already registered")
            update_fields.append("email = :email")
            params["email"] = user_update.email
        
        if user_update.phone_number is not None:
            update_fields.append("phone_number = :phone_number")
            params["phone_number"] = user_update.phone_number
        
        if user_update.is_active is not None:
            update_fields.append("is_active = :is_active")
            params["is_active"] = user_update.is_active
        
        if update_fields:
            update_fields.append("updated_at = NOW()")
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = :user_id"
            db.execute(text(query), params)
            db.commit()
        
        # Get updated user
        return await get_user(user_id, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{user_id}")
async def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete user"""
    try:
        # Check if user exists
        result = db.execute(text("SELECT id FROM users WHERE id = :user_id"), {"user_id": user_id})
        if not result.first():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete related records first
        db.execute(text("DELETE FROM notifications WHERE user_id = :user_id"), {"user_id": user_id})
        db.execute(text("DELETE FROM alerts WHERE user_id = :user_id"), {"user_id": user_id})
        
        # Delete user
        db.execute(text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id})
        db.commit()
        
        return {"message": "User deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/alerts/", response_model=List[AlertResponse])
async def get_user_alerts(user_id: int, db: Session = Depends(get_db)):
    """Get alerts for a specific user"""
    try:
        # Check if user exists
        result = db.execute(text("SELECT name, phone_number FROM users WHERE id = :user_id"), {"user_id": user_id})
        user_row = result.first()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get alerts
        result = db.execute(text("""
            SELECT id, title, filters, is_active, created_at
            FROM alerts
            WHERE user_id = :user_id
        """), {"user_id": user_id})
        
        alerts = []
        for row in result:
            # Parse filters JSON to get subject preferences
            subject_preferences = []
            max_distance_km = 50  # default
            
            if row[2]:  # filters column
                try:
                    import json
                    filters = json.loads(row[2])
                    subject_preferences = filters.get('subjects', [])
                    max_distance_km = filters.get('max_distance_km', 50)
                except:
                    pass
            
            alert_data = {
                "id": row[0],
                "user_name": user_row[0],
                "whatsapp_number": user_row[1] or "",
                "subject_preferences": subject_preferences,
                "max_distance_km": max_distance_km,
                "created_at": row[3],
                "is_active": row[4]
            }
            alerts.append(AlertResponse(**alert_data))
        
        return alerts
    except Exception as e:
        if "doesn't exist" in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/contest-notifications/", response_model=List[ContestNotificationResponse])
async def get_user_contest_notifications(user_id: int, db: Session = Depends(get_db)):
    """Get contest notifications sent to a specific user"""
    try:
        # Check if user exists
        result = db.execute(text("SELECT id FROM users WHERE id = :user_id"), {"user_id": user_id})
        if not result.first():
            raise HTTPException(status_code=404, detail="User not found")
        
        # Get notifications
        result = db.execute(text("""
            SELECT n.id, n.user_id, n.contest_id, n.sent_at,
                   c.title, c.school_name, c.subject_name, c.date
            FROM notifications n
            LEFT JOIN contests c ON n.contest_id = c.id
            WHERE n.user_id = :user_id
            ORDER BY n.sent_at DESC
        """), {"user_id": user_id})
        
        notifications = []
        for row in result:
            notification_data = {
                "id": row[0],
                "user_id": row[1],
                "contest_id": row[2],
                "contest_title": row[3] or "Unknown Contest",
                "school_name": row[4] or "Unknown School",
                "subject_name": row[5] or "Unknown Subject",
                "sent_at": row[6],
                "contest_date": row[7] or ""
            }
            notifications.append(ContestNotificationResponse(**notification_data))
        
        return notifications
    except Exception as e:
        if "doesn't exist" in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))
