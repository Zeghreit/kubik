#!/usr/bin/env python3
"""Extract UI and serialization functions"""

html_file = r'C:\Users\a.bodrov\Projects\kubik\index.html'

with open(html_file, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

def extract_function(start_line, max_lines=150):
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
    ('mirrorSelectedObjects', 19679),
    ('flipSelectedObjects', 19775),
    ('showMirrorChooser', 19807),
]

output = []
for name, line_num in functions:
    output.append(f"\n{'='*60}\n{name} (line {line_num})\n{'='*60}\n")
    result = extract_function(line_num, 200)
    if result:
        output.append(result)
    else:
        output.append(f"Could not extract")

# Now add serialization context
output.append(f"\n{'='*60}\nserializeDoc / symmetry field (around line 20757)\n{'='*60}\n")
for i in range(20750, min(20765, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\nrestoreDoc / symmetry field (around line 21080)\n{'='*60}\n")
for i in range(21075, min(21090, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\nApp.symmetry initial definition (around line 2790)\n{'='*60}\n")
for i in range(2785, min(2800, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\nsetSymmetry toggle handler (around line 24615)\n{'='*60}\n")
for i in range(24605, min(24650, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\n#symAxisGroup handlers (around line 24641)\n{'='*60}\n")
for i in range(24635, min(24655, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\n#symPill handlers (around line 23530)\n{'='*60}\n")
for i in range(23525, min(23540, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

output.append(f"\n{'='*60}\n#symPill handlers (around line 25180)\n{'='*60}\n")
for i in range(25175, min(25190, len(lines))):
    output.append(f"{i+1}: {lines[i]}")

# Write to file
with open(r'C:\Users\a.bodrov\Projects\kubik\symmetry_ui.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print("Extracted to symmetry_ui.txt")
