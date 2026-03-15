from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any

@dataclass
class BaseEntity:
    """Base entity with common fields"""
    id: Optional[int] = field(default=None, init=False)
    created_at: Optional[datetime] = field(default=None, init=False)
    updated_at: Optional[datetime] = field(default=None, init=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert entity to dictionary"""
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseEntity':
        """Create entity from dictionary"""
        # This should be overridden by subclasses
        return cls(**data)
