import sys
import os
from pathlib import Path

# Add src directory to Python path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))
