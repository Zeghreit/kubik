#!/usr/bin/env python3
"""Comprehensive mapping of all symmetry axis usage"""

import re

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

output = []

# Every read of App.symmetryAxis with full context
output.append(f"\n{'='*70}\nEVERY READ OF App.symmetryAxis WITH CONTEXT\n{'='*70}\n")
for i, line in enumerate(lines):
    if 'App.symmetryAxis' in line:
        start = max(0, i - 2)
        end = min(len(lines), i + 3)
        for j in range(start, end):
            marker = ">>> " if j == i else "    "
            output.append(f"{marker}{j+1}: {lines[j][:100]}")
        output.append("---")

# Every read of App.symmetry with full context
output.append(f"\n{'='*70}\nEVERY READ OF App.symmetry WITH CONTEXT\n{'='*70}\n")
for i, line in enumerate(lines):
    if re.search(r'App\.symmetry\b', line) and 'App.symmetryAxis' not in line:
        start = max(0, i - 2)
        end = min(len(lines), i + 3)
        for j in range(start, end):
            marker = ">>> " if j == i else "    "
            output.append(f"{marker}{j+1}: {lines[j][:100]}")
        output.append("---")

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\all_symmetry_reads.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to all_symmetry_reads.txt")
print(f"Total lines: {len(lines)}")
