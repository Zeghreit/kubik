#!/usr/bin/env python3
"""Find all operations with axis drawers and how they reference App.symmetryAxis"""

import re

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

output = []

# Find drawer definitions that have axis
output.append(f"\n{'='*60}\nAll drawer definitions with 'axis' field\n{'='*60}\n")
in_drawer = False
drawer_start = 0
for i, line in enumerate(lines):
    if 'drawer:' in line and i > 12000:  # skip early
        in_drawer = True
        drawer_start = i
    elif in_drawer and ('drawer:' in line or (i - drawer_start) > 50):
        in_drawer = False
    
    if in_drawer and 'axis' in line.lower():
        start = max(0, drawer_start)
        end = min(len(lines), i + 15)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
        output.append("---DRAWER_END---\n")
        in_drawer = False

# Search for all mentions of "axis:" in operation contexts
output.append(f"\n{'='*60}\nAll 'axis:' field assignments in operations\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'axis:' in line and i > 12000:
        start = max(0, i - 5)
        end = min(len(lines), i + 10)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
        output.append("---")

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\axis_drawers.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to axis_drawers.txt")
