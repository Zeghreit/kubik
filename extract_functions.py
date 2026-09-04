#!/usr/bin/env python3
"""Extract symmetry functions from index.html"""

import re

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

def extract_function(start_line, max_lines=100):
    """Extract function starting at given line number (1-indexed)"""
    start_idx = start_line - 1
    if start_idx >= len(lines):
        return None
    
    result = []
    brace_depth = 0
    found_opening = False
    
    for i in range(start_idx, min(start_idx + max_lines, len(lines))):
        line = lines[i]
        result.append(f"{i+1}: {line}")
        
        # Count braces
        brace_depth += line.count('{') - line.count('}')
        
        if '{' in line:
            found_opening = True
        
        # Stop when we close the function
        if found_opening and brace_depth == 0 and '{' in lines[start_idx]:
            break
    
    return '\n'.join(result)

functions = [
    ('captureSymmetryPlane', 6909),
    ('symmetryPlane', 6930),
    ('markElements', 6954),
    ('resolveElements', 6971),
    ('runMirrored', 7003),
    ('opSymmetry', 7043),
    ('mirrorOfSelection', 7054),
    ('expandSelectionToMirror', 7097),
    ('symExpand', 7107),
    ('buildSymmetryMap', 7113),
    ('mirrorMatrixForPlane', 7518),
    ('planeSpan', 7530),
    ('bisectObject', 7554),
    ('mirrorObject', 7620),
]

output = []
for name, line_num in functions:
    output.append(f"\n{'='*60}\n{name} (line {line_num})\n{'='*60}\n")
    result = extract_function(line_num)
    if result:
        output.append(result)
    else:
        output.append(f"Could not extract")

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\symmetry_functions.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to symmetry_functions.txt")
