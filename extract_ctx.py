#!/usr/bin/env python3
"""Extract ctx and op handling"""

import re

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

output = []

# Find ctx initialization around line 15083
output.append(f"\n{'='*60}\nctx initialization and mirror handling (around line 15080)\n{'='*60}\n")
for i in range(15070, min(15130, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

# Find all operations (key: 'xxx' patterns)
output.append(f"\n{'='*60}\nAll operation definitions (key: patterns)\n{'='*60}\n")
for i, line in enumerate(lines):
    if re.search(r"key:\s*['\"]", line) and i > 12000:  # skip early parts
        output.append(f"{i+1}: {line[:120]}")

# Find runOp definition
output.append(f"\n{'='*60}\nrunOp definition\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'function runOp(' in line:
        start = i
        end = min(len(lines), i + 50)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
        break

# Find where runMirrored is called
output.append(f"\n{'='*60}\nCalls to runMirrored\n{'='*60}\n")
for i, line in enumerate(lines):
    if 'runMirrored' in line and 'function runMirrored' not in line:
        start = max(0, i - 3)
        end = min(len(lines), i + 4)
        for j in range(start, end):
            output.append(f"{j+1}: {lines[j]}")
        output.append("---")

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\symmetry_ctx.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to symmetry_ctx.txt")
