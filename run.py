#!/usr/bin/env python3
"""
CloudNap - Huawei Cloud Cluster Management
Entry point for running the application.
"""

import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
