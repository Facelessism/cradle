from lxml import etree

# Whitelist definition of benign SVG elements and attributes
ALLOWED_TAGS = {
    '{http://w3.org}svg', '{http://w3.org}path',
    '{http://w3.org}circle', '{http://w3.org}rect',
    '{http://w3.org}g', '{http://w3.org}line',
    '{http://w3.org}polygon', '{http://w3.org}text',
    '{http://www.w3.org/2000/svg}svg', '{http://www.w3.org/2000/svg}path',
    '{http://www.w3.org/2000/svg}circle', '{http://www.w3.org/2000/svg}rect',
    '{http://www.w3.org/2000/svg}g', '{http://www.w3.org/2000/svg}line',
    '{http://www.w3.org/2000/svg}polygon', '{http://www.w3.org/2000/svg}text',
    'svg', 'path', 'circle', 'rect', 'g', 'line', 'polygon', 'text'
}

def sanitize_svg_content(raw_svg_bytes: bytes) -> bytes:
    """
    Parses untrusted SVG data, stripping out malicious <script> vectors, 
    javascript event triggers, and blocking XXE external resources.
    """
    # Defensive parsing configuration blocking external reference execution
    parser = etree.XMLParser(
        resolve_entities=False, 
        no_network=True, 
        remove_comments=True,
        remove_pis=True
    )
    
    try:
        root = etree.fromstring(raw_svg_bytes, parser=parser)
    except etree.XMLSyntaxError:
        raise ValueError("Invalid SVG/XML structure provided.")

    # 1. Clean elements and elements hierarchy trees
    for element in list(root.iter()):
        # Remove explicitly forbidden tags or tags missing from the structural whitelist
        if element.tag not in ALLOWED_TAGS or 'script' in element.tag.lower():
            parent = element.getparent()
            if parent is not None:
                parent.remove(element)
            continue

        # 2. Clean interactive attributes and event listeners
        for attr in list(element.attrib.keys()):
            attr_lower = attr.lower()
            # Catch inline event triggers (onmouseover, onload, etc.) and JS links
            if attr_lower.startswith('on') or 'javascript:' in element.attrib[attr].lower():
                del element.attrib[attr]

    return etree.tostring(root, xml_declaration=True, encoding='utf-8')
