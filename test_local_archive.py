import os
import sys
sys.path.append(os.path.abspath('backend'))

from app.services.local_archive import list_sessions
print(list_sessions(2026))
