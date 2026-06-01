---
name: no-auto-push
description: Use when preparing git operations, finishing development work, or considering pushing branches to a remote for this repository
---

# No Auto Push

## Overview

This repository must never be pushed automatically. Local edits and local commits are allowed, but `git push` requires an explicit user request in the current conversation.

## Rules

- Do not run `git push` unless the user explicitly asks for it.
- Do not treat "finish the work", "open a PR", or "publish changes" as implied permission to push.
- If push is needed to complete a requested workflow, stop and ask the user first.
- Default to staying on the current branch unless the user explicitly asks to create or switch branches.

## Quick Check

Before any remote operation, verify:

1. Did the user explicitly request a push in this conversation?
2. If not, stop at local changes or local commits only.
