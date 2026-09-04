#!/usr/bin/env python3
"""Extract caching and context variables related to symmetry"""

import re

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

output = []

# Find symQuietHistory
output.append(f"\n{'='*60}\nsymQuietHistory definition and reads\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'symQuietHistory' in line:
        output.append(f"{i+1}: {line}")

# Find ctx.mirrorMap
output.append(f"\n{'='*60}\nctx.mirrorMap and ctx.mirrorOffset\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'ctx.mirrorMap' in line or 'ctx.mirrorOffset' in line:
        output.append(f"{i+1}: {line}")

# Find opSketcher op definition
output.append(f"\n{'='*60}\nopSketcher operation (look for axis parameter)\n{'='*60}\n")
for i, line in enumerate(lines):
    if "key: 'sketcher'" in line or "'sketcher'" in line and 'key' in line:
        # Found it, extract context
        start = max(0, i - 5)
        end = min(len(lines), i + 60)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
        break

# Look for drawers that have axis
output.append(f"\n{'='*60}\nDrawer definitions with axis\n{'='*60}\n")
drawer_search = 0
for i, line in enumerate(lines):
    if 'drawer:' in line and i > 12000:  # Skip early definitions
        start = max(0, i - 2)
        end = min(len(lines), i + 25)
        in_drawer = False
        for j in range(start, end):
            if 'axis:' in lines[j]:
                for k in range(start, end):
                    output.append(f"{k+1}: {lines[k]}")
                output.append("---")
                break

# Find activeMirrorPlane
output.append(f"\n{'='*60}\nactiveMirrorPlane definition\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'function activeMirrorPlane' in line:
        start = i
        end = min(len(lines), i + 30)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
            if j > start and lines[j].count('}') > lines[j].count('{'):
                break

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\symmetry_caches.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to symmetry_caches.txt")
