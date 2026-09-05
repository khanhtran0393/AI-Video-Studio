'Sắp xếp tên file theo giá trị số: part1 < part2 < … < part10.'
from __future__ import annotations
import os
import re

def natural_sort_key(text: str) -> list[object]:
    return [int(part) if part.isdigit() else part.lower() for part in re.split('(\\d+)', text)]

def media_basename_sort_key(path_or_name: str) -> list[object]:
    return natural_sort_key(os.path.basename(path_or_name))