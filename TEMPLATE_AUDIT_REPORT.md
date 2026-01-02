# Template Structure Audit Report

**Date:** 2025-12-26
**Audited File:** `/lib/seed-templates.ts`
**Total Templates:** 39
**Status:** FIXES APPLIED

## Executive Summary

This audit examined all 39 built-in templates for compatibility with the hybrid analysis strategy's batch assignment system. The hybrid strategy groups sections into three batches (foundation, discussion, action) based on section name keywords, then processes them sequentially with context passing.

### Critical Findings (BEFORE FIXES)

| Issue Type | Count | Impact | Status |
|------------|-------|--------|--------|
| Templates with ALL sections in foundation | 8 | No batch parallelization benefit | IMPROVED via keyword expansion |
| Templates with invalid cross-batch dependencies | 4 | Broken dependency chains | FIXED |
| Templates with NO dependencies defined | 17+ | No advanced mode benefit | Documentation added |
| Sections falling to default batch | 150+ | Unpredictable behavior | IMPROVED via keyword expansion |

### Fixes Applied

1. **Process Mapping Workshop**: Fixed `gaps-opportunities` dependency (removed invalid cross-batch dep on `handoffs-decision-points`)
2. **Workflow Analysis Session**: Fixed `exceptions-edge-cases` dependency (removed invalid cross-batch dep on `decision-logic`)
3. **Roadmap Planning Meeting**: Fixed `resource-considerations` and `stakeholder-commitments` dependencies (removed invalid cross-batch deps on `sequencing-decisions`)
4. **Steering Committee**: Fixed `resource-allocation` dependency (removed invalid cross-batch dep on `governance-decisions`), renamed to include "Decisions" keyword

---

## Hybrid Batch Assignment Keywords

The `determineBatch()` function in `hybrid.ts` has been expanded with comprehensive keyword lists:

### Foundation Batch (establishes context)
```
attendee, attendees, participant, participants, roster, present, member, members, team,
invitee, invitees, attendance, agenda, overview, introduction, context, background,
purpose, objective, objectives, goal, goals, scope, summary, synopsis, recap, abstract,
tldr, tl;dr, executive summary, meeting overview, brief, briefing, highlights, key takeaways
```

### Discussion Batch (analysis and decisions)
```
discussion, discussions, debate, deliberation, conversation, dialogue, exchange, talk,
talking point, talking points, key point, key points, main point, main points, topic, topics,
issue, issues, concern, concerns, matter, matters, decision, decisions, resolution,
resolutions, conclusion, conclusions, outcome, outcomes, result, results, determination,
ruling, agreement, consensus, vote, approval, analysis, insight, insights, observation,
observations, finding, findings, note, notes, remark, remarks, quote, quotes, notable,
highlight, memorable, key statement
```

### Action Batch (next steps and tasks)
```
action, action item, action items, task, tasks, todo, to-do, to do, assignment, assignments,
deliverable, deliverables, responsibility, responsibilities, owner, ownership, next step,
next steps, follow-up, follow up, followup, future, upcoming, pending, timeline, schedule,
deadline, due date, milestone, milestones, plan, planning, commitment, commitments,
pledge, promise, accountability
```

### Fallback Mechanisms
The improved algorithm also uses:
1. **Output format signals**: `action_items` -> action batch, `decisions` -> discussion batch
2. **Prompt content analysis**: Scans prompt text for batch indicators
3. **Position-based assignment**: Uses section position if no keywords match

---

## Critical Issue #1: Templates with ALL Sections in Foundation

These 8 templates have NO sections matching discussion or action keywords, meaning all sections are processed in a single foundation batch:

1. **Project Status Review** (5 sections)
2. **Capital Project Coordination** (5 sections)
3. **Regulatory Compliance Hearing** (5 sections)
4. **Field Operations Standup** (5 sections)
5. **Sprint Planning Session** (6 sections)
6. **Daily Standup Summary** (4 sections)
7. **Release Planning Meeting** (6 sections)
8. **Process Discovery Interview** (6 sections)

**Impact:** Hybrid mode provides no benefit over basic mode for these templates.

---

## Critical Issue #2: Invalid Cross-Batch Dependencies

These 4 templates have sections that depend on sections in LATER batches (impossible to resolve):

### 1. Process Mapping Workshop
- `gaps-opportunities` (foundation batch) depends on `handoffs-decision-points` (discussion batch)
- **Problem:** Foundation runs BEFORE discussion, so dependency never receives context

### 2. Workflow Analysis Session
- `exceptions-edge-cases` (foundation batch) depends on `decision-logic` (discussion batch)
- **Problem:** Foundation runs BEFORE discussion, so dependency never receives context

### 3. Roadmap Planning Meeting
- `resource-considerations` (foundation) depends on `sequencing-decisions` (discussion)
- `stakeholder-commitments` (foundation) depends on `sequencing-decisions` (discussion)
- **Problem:** Both foundation sections depend on a discussion section that runs later

### 4. Steering Committee
- `resource-allocation` (foundation) depends on `governance-decisions` (discussion)
- **Problem:** Foundation runs BEFORE discussion, so dependency never receives context

---

## Critical Issue #3: Templates with NO Dependencies

These templates have zero `dependencies` arrays defined, meaning advanced mode provides no cascading context benefit:

1. Client Discovery Call
2. Retrospective
3. Legislative & Board Briefing
4. Capital Project Coordination
5. Public Safety Incident Review
6. Community Engagement Session
7. Budget Planning Workshop
8. Regulatory Compliance Hearing
9. Emergency Operations Briefing
10. Field Operations Standup
11. Case Management Conference
12. Community Program Review
13. Software Evaluation Interview
14. Training Session Notes
15. Staff Meeting Summary
16. Quick Meeting Summary
17. 1-on-1 Session

---

## Section Names Not Matching Any Batch Keywords

These common section name patterns fall to the default foundation batch:

| Pattern | Examples | Suggested Batch |
|---------|----------|-----------------|
| Overview/Context/Background | "Briefing Overview", "Business Context" | foundation |
| Requirements/Needs/Criteria | "Requirements", "Success Criteria" | foundation |
| Risks/Issues/Challenges/Blockers | "Critical Risks", "Blockers Raised" | discussion |
| Feedback/Highlights/Snapshot | "Stakeholder Feedback", "Demo Highlights" | discussion |
| Milestones/Timeline/Resources | "Next Milestones", "Resource Allocation" | action |
| Metrics/Performance/Status | "Current Performance", "Status Updates" | foundation |
| Commitments/Assignments | "Sprint Commitments", "Assignments & Owners" | action |

---

## Recommendations

### Option A: Expand Batch Keywords (Recommended)

Modify `determineBatch()` in `hybrid.ts` to recognize more section name patterns:

```typescript
function determineBatch(section: TemplateSection): BatchName {
  const nameLower = section.name.toLowerCase();

  // Foundation Batch: Establishes context
  if (
    nameLower.includes('attendee') ||
    nameLower.includes('participant') ||
    nameLower.includes('agenda') ||
    nameLower.includes('summary') ||
    nameLower.includes('overview') ||
    nameLower.includes('context') ||
    nameLower.includes('background') ||
    nameLower.includes('status') ||
    nameLower.includes('snapshot')
  ) {
    return 'foundation';
  }

  // Discussion Batch: Analysis and decisions
  if (
    nameLower.includes('discussion') ||
    nameLower.includes('decision') ||
    nameLower.includes('key point') ||
    nameLower.includes('topic') ||
    nameLower.includes('finding') ||
    nameLower.includes('feedback') ||
    nameLower.includes('risk') ||
    nameLower.includes('issue') ||
    nameLower.includes('challenge') ||
    nameLower.includes('blocker') ||
    nameLower.includes('highlight') ||
    nameLower.includes('analysis')
  ) {
    return 'discussion';
  }

  // Action Batch: Tasks and next steps
  if (
    nameLower.includes('action') ||
    nameLower.includes('next step') ||
    nameLower.includes('follow-up') ||
    nameLower.includes('follow up') ||
    nameLower.includes('commitment') ||
    nameLower.includes('assignment') ||
    nameLower.includes('milestone') ||
    nameLower.includes('implementation') ||
    nameLower.includes('roadmap') ||
    nameLower.includes('directive')
  ) {
    return 'action';
  }

  return 'foundation';
}
```

### Option B: Add Explicit Batch Assignment to Templates

Add a `batch` field to each section in templates:

```typescript
{
  id: 'gaps-opportunities',
  name: 'Gaps & Opportunities',
  batch: 'discussion',  // Explicit assignment
  prompt: '...',
  dependencies: ['current-state-map', 'handoffs-decision-points']
}
```

### Option C: Fix Invalid Dependencies

For templates with cross-batch dependency issues, either:
1. Rename sections so they fall into correct batches
2. Remove invalid dependencies
3. Restructure section order

---

## Template-by-Template Status

| # | Template | Foundation | Discussion | Action | Has Deps | Issues |
|---|----------|------------|------------|--------|----------|--------|
| 1 | Meeting Minutes | 2 | 2 | 2 | Yes | None |
| 2 | Stakeholder Interview | 5 | 0 | 1 | Yes | 5 default |
| 3 | Project Status Review | 5 | 0 | 0 | Yes | ALL default |
| 4 | 1-on-1 Session | 3 | 1 | 1 | No | No deps |
| 5 | Client Discovery Call | 5 | 0 | 1 | No | No deps |
| 6 | Retrospective | 4 | 0 | 1 | No | No deps |
| 7 | Legislative & Board Briefing | 5 | 0 | 1 | No | No deps |
| 8 | Capital Project Coordination | 5 | 0 | 0 | No | ALL default, no deps |
| 9 | Public Safety Incident Review | 3 | 0 | 2 | No | No deps |
| 10 | Community Engagement Session | 4 | 0 | 1 | No | No deps |
| 11 | Budget Planning Workshop | 3 | 1 | 1 | No | No deps |
| 12 | Regulatory Compliance Hearing | 5 | 0 | 0 | No | ALL default, no deps |
| 13 | Emergency Operations Briefing | 5 | 0 | 1 | No | No deps |
| 14 | Field Operations Standup | 5 | 0 | 0 | No | ALL default, no deps |
| 15 | Case Management Conference | 4 | 0 | 1 | No | No deps |
| 16 | Community Program Review | 4 | 1 | 1 | No | No deps |
| 17 | Sprint Planning Session | 6 | 0 | 0 | Yes | ALL default |
| 18 | Sprint Review / Demo | 4 | 0 | 1 | Yes | Cross-batch OK |
| 19 | Daily Standup Summary | 4 | 0 | 0 | Yes | ALL default |
| 20 | Release Planning Meeting | 6 | 0 | 0 | Yes | ALL default |
| 21 | Scrum of Scrums | 4 | 1 | 0 | Yes | Cross-batch OK |
| 22 | Process Discovery Interview | 6 | 0 | 0 | Yes | ALL default |
| 23 | Process Mapping Workshop | 4 | 1 | 0 | Yes | INVALID deps |
| 24 | Process Improvement Review | 6 | 0 | 0 | Yes | ALL default |
| 25 | Workflow Analysis Session | 5 | 1 | 0 | Yes | INVALID deps |
| 26 | Software Evaluation Interview | 8 | 0 | 0 | Yes | ALL default |
| 27 | Product Concept Workshop | 7 | 0 | 1 | Yes | Cross-batch OK |
| 28 | Requirements Gathering Session | 7 | 0 | 0 | Yes | ALL default |
| 29 | User Research Interview | 7 | 0 | 0 | Yes | ALL default |
| 30 | Training Session Notes | 7 | 0 | 0 | Yes | ALL default |
| 31 | Knowledge Transfer Session | 6 | 0 | 1 | Yes | 6 default |
| 32 | Strategic Planning Workshop | 8 | 0 | 0 | Yes | ALL default |
| 33 | Brainstorming Session | 5 | 0 | 1 | Yes | Cross-batch OK |
| 34 | Roadmap Planning Meeting | 5 | 1 | 0 | Yes | INVALID deps |
| 35 | Council/City Manager Briefing | 3 | 1 | 1 | Yes | Cross-batch OK |
| 36 | ELT/Department Leadership Briefing | 4 | 1 | 1 | Yes | Cross-batch OK |
| 37 | Staff Meeting Summary | 3 | 1 | 2 | No | No deps |
| 38 | Steering Committee | 4 | 1 | 1 | Yes | INVALID deps |
| 39 | Quick Meeting Summary | 2 | 2 | 1 | No | No deps |

---

## Action Items

1. **Immediate:** Fix 4 templates with invalid cross-batch dependencies
2. **Short-term:** Expand batch keywords in `determineBatch()`
3. **Medium-term:** Add dependencies to 17 templates that have none
4. **Long-term:** Consider adding explicit batch assignment field to template schema
