import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stdout } from 'node:process'

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const migration = read('supabase/migrations/20260815000001_fix_resume_share_public_snapshot.sql')
assert.match(migration, /SET lock_timeout = '3s'/u)
assert.match(migration, /p_expected_document_revision bigint/u)
assert.match(migration, /p_expected_document_revision IS DISTINCT FROM v_version\.document_revision/u)
assert.match(migration, /FOR SHARE;/u)
assert.match(migration, /max\(releases\.release_no\)/u)
assert.doesNotMatch(migration, /max\(release_no\)/u)
assert.doesNotMatch(migration, /p_snapshot IS DISTINCT FROM v_version\.snapshot/u)
assert.match(migration, /p_share_id, v_release_no, p_snapshot, p_template_manifest/u)
assert.match(migration, /snapshot = p_snapshot/u)
assert.doesNotMatch(migration, /v_release_no, v_version\.snapshot/u)

const shareFunction = read('supabase/functions/resume-share/index.ts')
assert.match(shareFunction, /snapshot: currentRelease\.snapshot/u)
assert.doesNotMatch(shareFunction, /snapshot: version\.snapshot/u)

const shareClient = read('src/lib/supabase/resume/share.ts')
assert.match(shareClient, /commentAnchorDocument: commentAnchor\.document/u)
assert.match(shareClient, /p_anchor_document: release\.commentAnchorDocument/u)
assert.match(shareClient, /p_expected_document_revision: release\.documentRevision/u)
assert.match(shareClient, /sharePublishRequests\.get\(shareId\)/u)
assert.match(shareClient, /\.abortSignal\(controller\.signal\)/u)

const drawer = read('src/components/ui/drawer.tsx')
assert.match(drawer, /data-\[swipe-axis=y\]:\[--drawer-content-height:70dvh\]/u)
assert.match(drawer, /data-\[swipe-axis=y\]:\[--drawer-content-max-height:70dvh\]/u)

const verticalDrawerFiles = [
  'src/components/ui/responsive-dialog.tsx',
  'src/features/resume-comments/components/comments-panel.tsx',
  'src/pages/history/components/detail-panel/index.tsx',
  'src/pages/optimize/components/analysis/Issue-fix/index.tsx',
  'src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx',
  'src/pages/resume/editor/index.tsx',
  'src/pages/share/components/quick-dialog/index.tsx',
  'src/pages/tracker/components/drawer/index.tsx',
]
for (const path of verticalDrawerFiles) {
  const source = read(path)
  assert.doesNotMatch(
    source,
    /h-\[(?:60|80|92|94)dvh\]|h-160|--drawer-content-height:(?:calc\(100dvh|min\(80dvh|94dvh)|--drawer-content-max-height:(?:calc\(100dvh|80dvh|94dvh)/u,
    `${path} 仍覆盖纵向 Drawer 的全局 70dvh 高度`,
  )
}

const drawerHeaderFiles = [
  'src/features/resume-comments/components/comments-panel.tsx',
  'src/pages/assistant/components/assistant-canvas/index.tsx',
  'src/pages/assistant/components/assistant-sidebar/index.tsx',
  'src/pages/optimize/components/advanced-tools/shared/modal.tsx',
  'src/pages/resume/editor/components/sidebar/mobile-sort-drawer.tsx',
  'src/pages/share/components/quick-dialog/index.tsx',
  'src/pages/tracker/components/drawer/index.tsx',
]
for (const path of drawerHeaderFiles) {
  const source = read(path)
  assert.doesNotMatch(source, /<DrawerClose[\s\S]{0,500}<X/u, `${path} 仍包含 Drawer 右上角 X`)
}

const command = read('src/components/ui/command.tsx')
assert.match(command, /commandProps\?: React\.ComponentProps<typeof CommandPrimitive>/u)
assert.match(command, /<Command \{\.\.\.commandProps\}>/u)

const codeBlock = read('src/components/ui/code-block.tsx')
const styles = read('src/index.css')
assert.match(codeBlock, /data-code-block=""/u)
assert.match(codeBlock, /not-prose/u)
assert.match(styles, /\.dark \[data-code-block\] \.shiki span/u)
assert.match(styles, /color: var\(--shiki-dark\) !important/u)

const overview = read('src/pages/tracker/components/overview-bar/index.tsx')
const trackerDrawer = read('src/pages/tracker/components/drawer/index.tsx')
const trackerStore = read('src/pages/tracker/store.ts')
assert.match(overview, /aria-expanded=\{mobileExpanded\}/u)
assert.match(overview, /<AnimatePresence initial=\{false\}>/u)
assert.match(overview, /exit=\{reduce \? \{ opacity: 0 \} : \{ opacity: 0, height: 0 \}\}/u)
assert.match(overview, /bg-primary text-primary-foreground/u)
assert.match(overview, /aria-pressed:bg-primary aria-pressed:text-primary-foreground/u)
assert.match(overview, /group-aria-pressed:text-primary-foreground\/75/u)
assert.match(overview, /md:hidden/u)
assert.match(trackerDrawer, /const mobileFooter = isMobile/u)
assert.match(trackerDrawer, /setActiveTab\(selectedJob\.status === 'interview' \? 'interview' : 'follow-up'\)/u)
assert.match(trackerDrawer, /variant="line"/u)
assert.match(trackerDrawer, /sticky top-0 z-20 w-full rounded-none border-b bg-popover/u)
assert.match(trackerDrawer, /after:hidden data-\[state=active\]:border-foreground/u)
assert.match(trackerDrawer, /if \(!selectedJob\) \{[\s\S]{0,300}<Drawer[\s\S]{0,200}open=\{false\}/u)
assert.doesNotMatch(trackerDrawer, /if \(!selectedJob\)\s*return null/u)
assert.match(trackerStore, /set\(\{ selectedJob: job, drawerOpen: false \}\)/u)
assert.match(trackerStore, /pendingDrawerOpenFrame = requestAnimationFrame\(\(\) => \{/u)
assert.match(trackerStore, /state\.selectedJob\?\.id === job\.id \? \{ drawerOpen: true \} : \{\}/u)

stdout.write('mobile/share/AI stability verification passed\n')
