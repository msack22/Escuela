import googlemaps
import logging
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.domain.models.models import School
from app.domain.repositories.repositories import SchoolRepository
from app.core.config import settings

logger = logging.getLogger(__name__)


class GeocodingService:
    """Service for geocoding and maps operations using Google Maps API"""
    
    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Google Maps client if API key is available"""
        if settings.google_maps_api_key:
            try:
                self.client = googlemaps.Client(key=settings.google_maps_api_key)
                logger.info("Google Maps client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Google Maps client: {e}")
        else:
            logger.warning("Google Maps API key not configured")
    
    async def geocode_address(self, address: str, city: str = None, department: str = None) -> Optional[Dict[str, Any]]:
        """Geocode an address to get coordinates"""
        if not self.is_configured():
            logger.error("Google Maps client not configured")
            return None
        
        try:
            # Build full address
            address_parts = [address, city, department, "Argentina"]
            full_address = ", ".join(filter(None, address_parts))
            
            # Geocode the address
            result = self.client.geocode(full_address)
            
            if result and len(result) > 0:
                location = result[0]['geometry']['location']
                return {
                    'latitude': location['lat'],
                    'longitude': location['lng'],
                    'formatted_address': result[0]['formatted_address'],
                    'place_id': result[0].get('place_id')
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error geocoding address '{full_address}': {e}")
            return None
    
    async def reverse_geocode(self, latitude: float, longitude: float) -> Optional[Dict[str, Any]]:
        """Reverse geocode coordinates to get address information"""
        if not self.is_configured():
            logger.error("Google Maps client not configured")
            return None
        
        try:
            result = self.client.reverse_geocode((latitude, longitude))
            
            if result and len(result) > 0:
                address_components = result[0]['address_components']
                
                # Extract components
                city = None
                department = None
                route = None
                street_number = None
                
                for component in address_components:
                    types = component['types']
                    
                    if 'locality' in types:
                        city = component['long_name']
                    elif 'administrative_area_level_2' in types:
                        department = component['long_name']
                    elif 'route' in types:
                        route = component['long_name']
                    elif 'street_number' in types:
                        street_number = component['long_name']
                
                return {
                    'formatted_address': result[0]['formatted_address'],
                    'city': city,
                    'department': department,
                    'route': route,
                    'street_number': street_number,
                    'place_id': result[0].get('place_id')
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error reverse geocoding coordinates ({latitude}, {longitude}): {e}")
            return None
    
    def calculate_distance(self, origin_lat: float, origin_lng: float, 
                          dest_lat: float, dest_lng: float) -> Optional[float]:
        """Calculate distance between two points"""
        if not self.is_configured():
            # Fallback to Haversine formula
            return self._haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        
        try:
            result = self.client.distance_matrix(
                origins=[(origin_lat, origin_lng)],
                destinations=[(dest_lat, dest_lng)],
                units='metric'
            )
            
            if result['rows'][0]['elements'][0]['status'] == 'OK':
                distance_meters = result['rows'][0]['elements'][0]['distance']['value']
                return distance_meters / 1000  # Convert to kilometers
            
            return None
            
        except Exception as e:
            logger.error(f"Error calculating distance: {e}")
            # Fallback to Haversine formula
            return self._haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance using Haversine formula (fallback method)"""
        import math
        
        # Convert latitude and longitude to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radius of earth in kilometers
        r = 6371
        
        return c * r
    
    def generate_maps_link(self, latitude: float, longitude: float, 
                          address: str = None) -> str:
        """Generate Google Maps link for a location"""
        if latitude and longitude:
            return f"https://maps.google.com/?q={latitude},{longitude}"
        elif address:
            return f"https://maps.google.com/?q={address.replace(' ', '+')}"
        else:
            return "https://maps.google.com/"
    
    def generate_embedded_map_url(self, latitude: float, longitude: float, 
                                 width: int = 400, height: int = 300, 
                                 zoom: int = 15) -> str:
        """Generate embedded Google Maps URL"""
        if not self.is_configured():
            return ""
        
        base_url = "https://www.google.com/maps/embed/v1/place"
        params = [
            f"key={settings.google_maps_api_key}",
            f"q={latitude},{longitude}",
            f"zoom={zoom}",
            "maptype=roadmap"
        ]
        
        return f"{base_url}?{'&'.join(params)}"
    
    async def search_nearby_schools(self, latitude: float, longitude: float, 
                                  radius: int = 5000) -> Optional[list]:
        """Search for nearby schools using Places API"""
        if not self.is_configured():
            return None
        
        try:
            result = self.client.places_nearby(
                location=(latitude, longitude),
                radius=radius,
                type='school',
                keyword='escuela colegio'
            )
            
            schools = []
            for place in result.get('results', []):
                schools.append({
                    'name': place['name'],
                    'address': place.get('vicinity', ''),
                    'latitude': place['geometry']['location']['lat'],
                    'longitude': place['geometry']['location']['lng'],
                    'place_id': place['place_id'],
                    'rating': place.get('rating'),
                    'user_ratings_total': place.get('user_ratings_total', 0)
                })
            
            return schools
            
        except Exception as e:
            logger.error(f"Error searching nearby schools: {e}")
            return None
    
    def is_configured(self) -> bool:
        """Check if Google Maps client is properly configured"""
        return self.client is not None and settings.google_maps_api_key is not None


class SchoolGeocodingService:
    """Service for geocoding school addresses"""
    
    def __init__(self, db: Session):
        self.db = db
        self.school_repo = SchoolRepository(db)
        self.geocoding_service = GeocodingService()
    
    async def geocode_school(self, school_id: int) -> bool:
        """Geocode a specific school"""
        school = self.school_repo.get_by_id(school_id)
        if not school:
            return False
        
        # Skip if already geocoded
        if school.latitude and school.longitude:
            return True
        
        # Geocode the address
        result = await self.geocoding_service.geocode_address(
            address=school.address,
            city=school.city,
            department=school.department
        )
        
        if result:
            school.latitude = result['latitude']
            school.longitude = result['longitude']
            self.school_repo.update(school)
            return True
        
        return False
    
    async def geocode_all_schools(self) -> Dict[str, int]:
        """Geocode all schools that don't have coordinates"""
        schools = self.db.query(School).filter(
            (School.latitude.is_(None)) | (School.longitude.is_(None))
        ).all()
        
        success_count = 0
        error_count = 0
        
        for school in schools:
            try:
                result = await self.geocoding_service.geocode_address(
                    address=school.address,
                    city=school.city,
                    department=school.department
                )
                
                if result:
                    school.latitude = result['latitude']
                    school.longitude = result['longitude']
                    self.school_repo.update(school)
                    success_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"Error geocoding school '{school.name}': {e}")
                error_count += 1
        
        return {
            'total': len(schools),
            'success': success_count,
            'errors': error_count
        }
