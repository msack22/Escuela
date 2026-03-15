from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime
from .base import BaseEntity

@dataclass
class Contest(BaseEntity):
    """Contest entity following Clean Architecture"""
    title: str
    description: str
    deadline: Optional[datetime] = None
    status: str = "active"
    requirements: Optional[List[str]] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    institution: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    source_url: Optional[str] = None
    
    def is_active(self) -> bool:
        """Check if contest is still active"""
        if self.deadline is None:
            return self.status == "active"
        return self.status == "active" and self.deadline > datetime.now()
    
    def days_until_deadline(self) -> Optional[int]:
        """Get days remaining until deadline"""
        if self.deadline is None:
            return None
        delta = self.deadline - datetime.now()
        return max(0, delta.days)
