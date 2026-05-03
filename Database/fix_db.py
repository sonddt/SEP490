điimport re

file_path = "d:/Do An/SEP490/Database/Database_realistic.txt"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We need to find the INSERT INTO venues statement and modify only that block
# Pattern to match the values part of the INSERT INTO venues
# Example: ,'NONE',NULL,10,5,60,TRUE
# Or ,'PERCENT',55,10,5,60,TRUE
# The columns are: refund_type, refund_percent, weekly_discount, monthly_discount, slot_duration, is_active

def replace_discount(match):
    prefix = match.group(1) # e.g. ,'PERCENT',55,
    weekly = int(match.group(2))
    monthly = int(match.group(3))
    suffix = match.group(4) # e.g. ,60,TRUE
    
    if weekly > monthly:
        # Swap them
        # Except if monthly is 0, maybe just make monthly = weekly + 5, or just swap. Swapping is fine: 0 weekly, 10 monthly.
        # But wait, 10 weekly and 5 monthly -> 5 weekly, 10 monthly.
        weekly, monthly = monthly, weekly
        
    return f"{prefix}{weekly},{monthly}{suffix}"

# Regex explanation:
# (,'(?:NONE|FIXED|PERCENT)',(?:NULL|\d+),)(\d+),(\d+)(,60,(?:TRUE|FALSE),)
pattern = re.compile(r"(,'(?:NONE|FIXED|PERCENT)',(?:NULL|\d+),)(\d+),(\d+)(,\d+,(?:TRUE|FALSE),)")

new_content = pattern.sub(replace_discount, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Fixed Database_realistic.txt")
