#!/usr/bin/env python3
"""Search for symmetry-related functions and variables in index.html"""

import re
import sys

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lines and build line-to-position mapping
lines = content.split('\n')
line_positions = [0]
for line in lines[:-1]:
    line_positions.append(line_positions[-1] + len(line) + 1)

def find_function_def(name):
    """Find function definition by name"""
    # Look for function declarations
    patterns = [
        rf'function\s+{re.escape(name)}\s*\(',
        rf'const\s+{re.escape(name)}\s*=\s*(?:function|\()',
        rf'{re.escape(name)}\s*[:=]\s*(?:function|\()',
    ]
    
    results = []
    for pattern in patterns:
        for match in re.finditer(pattern, content):
            pos = match.start()
            # Find which line this is
            line_num = next(i for i, p in enumerate(line_positions) if p > pos)
            results.append((line_num, match.group()))
    
    return sorted(set(results))

def find_all_reads(var_name):
    """Find all reads of a variable"""
    # Match App.symmetryAxis or App.symmetry references
    pattern = rf'App\.{re.escape(var_name)}\b'
    
    results = []
    for match in re.finditer(pattern, content):
        pos = match.start()
        line_num = next(i for i, p in enumerate(line_positions) if p > pos)
        # Get the line context
        line_text = lines[line_num - 1] if line_num <= len(lines) else ""
        results.append((line_num, line_text.strip()))
    
    return results

# Search for key functions
functions_to_find = [
    'symmetryPlane',
    'captureSymmetryPlane',
    'buildSymmetryMap',
    'mirrorMatrixForPlane',
    'planeSpan',
    'runMirrored',
    'opSymmetry',
    'mirrorOfSelection',
    'expandSelectionToMirror',
    'symExpand',
    'markElements',
    'resolveElements',
    'mirrorSelectedObjects',
    'flipSelectedObjects',
    'showMirrorChooser',
    'bisectObject',
    'mirrorObject',
]

print("=== FUNCTION DEFINITIONS ===\n")
for func in functions_to_find:
    defs = find_function_def(func)
    if defs:
        for line_num, match in defs:
            print(f"{func}: line {line_num} - {match[:80]}")
    else:
        print(f"{func}: NOT FOUND")

print("\n=== READS OF App.symmetryAxis ===\n")
axis_reads = find_all_reads('symmetryAxis')
print(f"Total reads: {len(axis_reads)}\n")
for line_num, text in axis_reads[:20]:  # Show first 20
    print(f"Line {line_num}: {text[:120]}")

print("\n=== READS OF App.symmetry ===\n")
sym_reads = find_all_reads('symmetry')
print(f"Total reads: {len(sym_reads)}\n")
for line_num, text in sym_reads[:20]:  # Show first 20
    print(f"Line {line_num}: {text[:120]}")

# Find App.symmetryAxis and App.symmetry initial definitions
print("\n=== APP.SYMMETRYAXIS / APP.SYMMETRY DEFINITIONS ===\n")
for match in re.finditer(r'App\.symmetry(?:Axis)?[\s:]*[=:]', content):
    pos = match.start()
    line_num = next(i for i, p in enumerate(line_positions) if p > pos)
    start_pos = line_positions[line_num - 1] if line_num <= len(lines) else 0
    end_pos = line_positions[line_num] if line_num < len(lines) else len(content)
    line_text = content[start_pos:end_pos].strip()
    print(f"Line {line_num}: {line_text[:150]}")
