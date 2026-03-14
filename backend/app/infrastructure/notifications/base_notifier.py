from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class NotificationMessage:
    """Data transfer object for notification messages"""
    recipient: str
    subject: str
    message: str
    contest_data: Optional[Dict[str, Any]] = None


class BaseNotifier(ABC):
    """Abstract base class for notification services following Strategy Pattern"""
    
    @abstractmethod
    async def send_notification(self, message: NotificationMessage) -> bool:
        """
        Send a notification message.
        
        Args:
            message: The notification message to send
            
        Returns:
            True if sent successfully, False otherwise
        """
        pass
    
    @abstractmethod
    def is_configured(self) -> bool:
        """
        Check if the notifier is properly configured.
        
        Returns:
            True if configured, False otherwise
        """
        pass
