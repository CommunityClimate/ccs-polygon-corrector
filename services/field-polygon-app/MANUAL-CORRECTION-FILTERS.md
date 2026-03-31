# 🔧 MANUAL CORRECTION TYPE FILTERS - Complete Guide!

## 🎯 **New Feature: Detailed Manual Correction Categorization!**

Now you can filter fields by **specific types of manual corrections** needed!

---

## 📊 **What's New:**

### **Manual Correction Types Filter Section:**
```
MANUAL CORRECTION TYPES:
☐ ✗ Self-Intersections [count]
☐ ◯ Not Closed [count]  
☐ ▽ Too Few Vertices [count]
☐ ◻ Zero/Negative Area [count]
☐ ⚬⚬ Duplicate Vertices [count]
```

**All checkboxes auto-apply when clicked!**

---

## 🎨 **Filter Details:**

### **1. Self-Intersections** ✗
```
Icon: ✗ (red cross)
Color: Red badge
Issue: Polygon edges cross each other
Severity: CRITICAL - Verra rejection
```

**What It Means:**
```
The polygon has lines that cross over themselves.
This creates an invalid "figure-8" or twisted shape.

Example:
    1──────2
    │     ╱
    │   ╱  
    │ ╱    
   4╱──────3  ← Edges cross!
```

**Why Critical:**
- Verra will reject the field
- Cannot calculate accurate area
- GPS data collection error
- Requires manual redrawing

**How To Fix:**
1. Load field in editor
2. Find intersection point
3. Drag vertices to uncross edges
4. Verify polygon is simple

---

### **2. Not Closed** ◯
```
Icon: ◯ (open circle)
Color: Yellow badge
Issue: Gap > 0.5m between first & last vertex
Severity: CRITICAL - Verra rejection
```

**What It Means:**
```
The polygon doesn't close properly.
First and last points don't match.

Example:
    1──────2
    │      │
    │      │
    4──────3
   ↓
   Missing connection! Gap > 0.5m
```

**Why It Happens:**
- GPS signal loss
- Incomplete field walk
- Data truncation
- Recording stopped early

**How To Fix:**
1. Load field in editor
2. Check first and last vertices
3. Drag last vertex to match first
4. Or add vertex to close gap

---

### **3. Too Few Vertices** ▽
```
Icon: ▽ (triangle)
Color: Orange badge
Issue: Less than 4 distinct vertices
Severity: CRITICAL - Verra requirement
```

**What It Means:**
```
Polygon has fewer than 4 unique points.
Verra requires minimum 4 distinct vertices.

Example:
   1───2
    \ /
     3    ← Only 3 vertices!
```

**Why It Happens:**
- Extremely small field
- Duplicate vertex coordinates
- Data compression error
- Simplified too aggressively

**How To Fix:**
1. Check if field is real (too small?)
2. Add vertices to corners
3. Remove exact duplicates
4. Verify field boundaries

---

### **4. Zero/Negative Area** ◻
```
Icon: ◻ (empty square)
Color: Pink badge
Issue: Area ≤ 1 m²
Severity: CRITICAL - Data error
```

**What It Means:**
```
The polygon has no measurable area.
This is almost always a data error.

Causes:
- All vertices at same location
- Vertices in a straight line
- Clockwise/counter-clockwise issue
- Collapsed geometry
```

**Why It Happens:**
- GPS data corruption
- Recording error
- Import/export bug
- Coordinate system mismatch

**How To Fix:**
1. Check if field exists
2. Re-collect GPS data
3. Verify coordinate system
4. May need to delete and re-add

---

### **5. Duplicate Vertices** ⚬⚬
```
Icon: ⚬⚬ (two dots)
Color: Purple badge
Issue: Consecutive identical coordinates
Severity: WARNING - Can affect accuracy
```

**What It Means:**
```
Two or more consecutive vertices have
identical coordinates (same location).

Example:
1──2,3,4──5  ← Vertices 2, 3, 4 are same point
│          │
8──7───────6
```

**Why It Happens:**
- GPS paused at same spot
- Recording continued while stationary
- Data duplication
- Poor GPS signal

**How To Fix:**
1. Load field in editor
2. Delete duplicate vertices
3. Keep only unique locations
4. Verify polygon shape

---

## 🎯 **How To Use:**

### **Basic Filtering:**
```
1. Open sidebar
2. Scroll to "MANUAL CORRECTION TYPES"
3. Check desired issue type(s)
4. Dropdown updates instantly
5. Export subset if needed
```

### **Example 1: Find Self-Intersections**
```
Action: Check "✗ Self-Intersections"
Result: Shows all fields with crossing edges
Count: "✗ Self-Intersections [142]"
Use: Focus on most critical issues first
```

### **Example 2: Find Multiple Issues**
```
Action: Check "✗ Self-Intersections" + "◯ Not Closed"
Result: Shows fields with EITHER issue (OR logic)
Count: Combined total shown in dropdown
Use: Group similar correction work
```

### **Example 3: Combined with Status Filter**
```
Action:
1. Select "Needs Manual Edit" (radio button)
2. Check "✗ Self-Intersections" (checkbox)

Result: Fields that are:
- Flagged as needing manual edit AND
- Have self-intersections specifically

Use: Ultra-focused subset for team assignment
```

---

## 💡 **Use Cases:**

### **Use Case 1: Prioritize Critical Issues**
```
Scenario: 350 fields need manual work
Problem: Too many to fix at once
Solution:
1. Check "✗ Self-Intersections" (142 fields)
2. Fix these first (Verra will reject)
3. Then check "◯ Not Closed" next batch
4. Systematic approach to corrections
```

### **Use Case 2: Team Assignment**
```
Scenario: Multiple people fixing fields
Solution:
Person A: Self-intersections (requires GIS skill)
Person B: Not closed (simple dragging)
Person C: Duplicate vertices (quick cleanup)
→ Everyone knows their focus area
```

### **Use Case 3: Data Quality Analysis**
```
Scenario: Understand data collection issues
Analysis:
- 142 self-intersections → GPS collection training needed
- 85 not closed → Recording process issue
- 231 duplicates → Device settings problem
→ Identify root causes for improvement
```

### **Use Case 4: Export Specific Issues**
```
Scenario: Send subset to field team for re-collection
Action:
1. Check "Zero/Negative Area"
2. Export filtered CSV
3. Send to field team
4. They re-collect those specific fields
```

---

## 📊 **Filter Logic:**

### **Multiple Checkboxes = OR Logic**
```
If you check:
✗ Self-Intersections
◯ Not Closed

Result: Fields that have EITHER:
- Self-intersections OR
- Not closed issues

Not: Fields with BOTH (that would be AND)
```

### **Combined with Other Filters:**
```
All filters combine with AND:

Status: "Needs Manual Edit" AND
Correction Type: "Self-Intersections" AND
Field Size: "XS Too Small" AND
Owner: "Smith"

= Very specific subset!
```

---

## 🎨 **Visual Reference:**

### **Your Sidebar Will Show:**
```
┌────────────────────────────────────┐
│ MANUAL CORRECTION TYPES:           │
├────────────────────────────────────┤
│ ☑ ✗ Self-Intersections [142]      │
│   Polygon edges cross each other   │
│                                    │
│ ☐ ◯ Not Closed [85]                │
│   Gap > 0.5m between vertices      │
│                                    │
│ ☐ ▽ Too Few Vertices [47]          │
│   Less than 4 distinct vertices    │
│                                    │
│ ☐ ◻ Zero/Negative Area [38]        │
│   Area ≤ 1 m² (likely data error)  │
│                                    │
│ ☐ ⚬⚬ Duplicate Vertices [231]      │
│   Consecutive identical coordinates│
└────────────────────────────────────┘
```

---

## 📋 **Real-World Workflow:**

### **Day 1: Critical Issues**
```
Morning:
1. Check "✗ Self-Intersections"
2. Result: 142 fields
3. Export CSV for team
4. Fix highest priority

Afternoon:
1. Check "◯ Not Closed"
2. Result: 85 fields
3. Quick fixes (drag vertices)
4. Mark complete
```

### **Day 2: Data Quality**
```
Morning:
1. Check "⚬⚬ Duplicate Vertices"
2. Result: 231 fields
3. Batch delete duplicates
4. Re-validate

Afternoon:
1. Check "◻ Zero/Negative Area"
2. Result: 38 fields
3. Flag for re-collection
4. Export list for field team
```

### **Day 3: Final Cleanup**
```
Morning:
1. Check "▽ Too Few Vertices"
2. Result: 47 fields
3. Verify real vs. errors
4. Add vertices or delete

Afternoon:
1. Clear all filters
2. Select "Needs Manual Edit"
3. Check remaining count
4. Should be much smaller!
```

---

## 🔧 **Technical Details:**

### **How Counting Works:**
```javascript
For each field:
1. Check validation.verra.checks
2. Check error messages
3. Check warning messages
4. Increment appropriate counter
5. Display in UI badge
```

### **Detection Logic:**

**Self-Intersections:**
```javascript
- checks.simple?.pass === false
- errors include "self-intersection"
- metrics.hasSelfIntersection === true
```

**Not Closed:**
```javascript
- checks.closed?.pass === false
- errors/warnings include "not properly closed"
```

**Too Few Vertices:**
```javascript
- checks.minVertices?.pass === false
- errors include "distinct vertices"
```

**Zero Area:**
```javascript
- checks.positiveArea?.pass === false
- metrics.areaM2 <= 1
```

**Duplicate Vertices:**
```javascript
- warnings include "duplicate"
```

---

## 🎊 **Benefits:**

### **Efficiency:**
```
Before: Manually check all 350 "Needs Manual" fields
After: Focus on 142 self-intersections first
→ 60% reduction in initial workload
```

### **Organization:**
```
Before: Mixed bag of issues
After: Categorized by type
→ Clear work assignments
```

### **Quality:**
```
Before: Fix issues randomly
After: Systematic approach by severity
→ Higher quality corrections
```

### **Reporting:**
```
Before: "We have some issues"
After: "142 self-intersections, 85 not closed"
→ Precise communication
```

---

## 🚀 **Quick Start:**

### **Find Your Most Critical Issues:**
```
1. Import data
2. Process all fields
3. Scroll to "MANUAL CORRECTION TYPES"
4. Check "✗ Self-Intersections"
5. See count
6. Start fixing!
```

### **Export Specific Issue Type:**
```
1. Check desired issue type
2. Dropdown shows filtered count
3. Click "Export CSV (142 filtered)"
4. Send to team
5. Track progress
```

---

## 💡 **Pro Tips:**

### **Tip 1: Start with Critical**
```
Fix in this order:
1. ✗ Self-Intersections (Verra rejects)
2. ◯ Not Closed (Verra rejects)
3. ▽ Too Few Vertices (Verra rejects)
4. ◻ Zero Area (data errors)
5. ⚬⚬ Duplicates (quality improvement)
```

### **Tip 2: Combine Wisely**
```
Don't check all boxes at once!
→ You'll get everything = no focus

Check 1-2 related issues:
→ "Self-Intersections" + "Not Closed"
→ Both are topology problems
→ Similar fixing approach
```

### **Tip 3: Export Before Fixing**
```
1. Filter to specific issue
2. Export CSV
3. Track original state
4. Fix issues
5. Compare before/after
→ Document improvements
```

### **Tip 4: Use with Field Size**
```
Combine for precision:
- "Self-Intersections"
- "XS Too Small"
→ Small fields with topology issues
→ May be data errors, not real fields
→ Consider deleting vs. fixing
```

---

## 🎯 **Summary:**

### **What You Can Do:**
```
✅ Filter by 5 manual correction types
✅ See exact count for each type
✅ Auto-apply filtering instantly
✅ Combine with other filters
✅ Export specific issue subsets
✅ Prioritize critical fixes
✅ Assign work by issue type
✅ Track progress systematically
```

### **Filter Types:**
```
✅ ✗ Self-Intersections
✅ ◯ Not Closed
✅ ▽ Too Few Vertices
✅ ◻ Zero/Negative Area
✅ ⚬⚬ Duplicate Vertices
```

---

**Download and organize your manual corrections systematically!** 🔧📊
