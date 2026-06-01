---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Language rule:** Unless the user explicitly requests another language, every generated plan document MUST be written in Simplified Chinese. This includes the title, section headings, task names, step descriptions, explanatory prose, and execution handoff text. Keep file paths, commands, code, APIs, and commit messages in their original language when needed, but all surrounding narration MUST remain in Simplified Chinese.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- **Repository rule (506-FETL/resume): this path is mandatory. Do not write plans anywhere else (e.g., not in `docs/plans/` or session workspace).**

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header（默认使用简体中文）:**

```markdown
# [功能名称] 实施计划

> **给代理执行者：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐步实现本计划。步骤使用复选框（`- [ ]`）语法跟踪，执行时必须把本文件同步更新为最新状态。

**目标：** [用一句话描述这次要实现什么]

**架构：** [用 2-3 句话说明实现方式]

**技术栈：** [关键技术或库]

---
```

## Task Structure

````markdown
### 任务 N：[组件名称]

**文件：**
- 新建：`exact/path/to/file.py`
- 修改：`exact/path/to/existing.py:123-145`
- 测试：`tests/exact/path/to/test.py`

- [ ] **步骤 1：先写失败测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **步骤 2：运行测试并确认它失败**

运行：`pytest tests/path/test.py::test_name -v`
预期：FAIL，并出现 "function not defined"

- [ ] **步骤 3：写最小实现**

```python
def function(input):
    return expected
```

- [ ] **步骤 4：再次运行测试并确认通过**

运行：`pytest tests/path/test.py::test_name -v`
预期：PASS

- [ ] **步骤 5：提交**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## Execution Tracking Contract

Plans are living execution records, not static proposals.

- During execution, the same markdown plan file MUST be updated in place
- Completed steps MUST be changed from `- [ ]` to `- [x]`
- Verification steps MUST append a short `执行记录：...` note with the real command result or environment limitation
- Blocked or skipped steps MUST stay unchecked and include a short note in the plan language explaining why
- The final plan file should let a reader understand actual progress without relying on chat history

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits
- Plan prose defaults to Simplified Chinese unless the user explicitly requests another language
- Plans must be written so executors can keep checkbox state and verification notes current inside the same file

## Plan Review Loop

After writing the complete plan:

1. Dispatch a single plan-document-reviewer subagent (see plan-document-reviewer-prompt.md) with precisely crafted review context — never your session history. This keeps the reviewer focused on the plan, not your thought process.
   - Provide: path to the plan document, path to spec document
2. If ❌ Issues Found: fix the issues, re-dispatch reviewer for the whole plan
3. If ✅ Approved: proceed to execution handoff

**Review loop guidance:**
- Same agent that wrote the plan fixes it (preserves context)
- If loop exceeds 3 iterations, surface to human for guidance
- Reviewers are advisory — explain disagreements if you believe feedback is incorrect

## Execution Handoff

After saving the plan, offer execution choice（默认使用简体中文）:

**“计划已完成并保存到 `docs/superpowers/plans/<filename>.md`。有两种执行方式：**

**1. 子代理驱动（推荐）** - 我按任务分派新的子代理执行，每步 review 后再推进，迭代更快

**2. 当前会话内执行** - 我在这个会话里使用 executing-plans 直接批量执行，并在检查点汇报

**你想用哪一种？”**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review

**If Inline Execution chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:executing-plans
- Batch execution with checkpoints for review
