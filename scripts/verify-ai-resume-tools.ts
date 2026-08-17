import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { stdout } from 'node:process'
import { isCloudResumeId, ResumeNotFoundError } from '../src/lib/resume-id.ts'

function readSource(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function readSection(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`)
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

assert.equal(isCloudResumeId('12fbe260-06b1-4072-89ee-ce90a9f06a0d'), true)
assert.equal(isCloudResumeId('00000000-0000-0000-0000-000000000000'), true)
assert.equal(isCloudResumeId('local-0991d248-0e55-4d2a-9bb5-8b25d6f6d003'), false)
assert.equal(isCloudResumeId('not-a-resume'), false)
assert.equal(new ResumeNotFoundError().code, 'RESUME_NOT_FOUND')

const cloudFormSource = readSource('../src/lib/supabase/resume/form.ts')
const getResumeByIdSource = readSection(
  cloudFormSource,
  'export async function getResumeById',
  'export async function uploadOfflineResumeToCloud',
)
assert.match(getResumeByIdSource, /if \(!isCloudResumeId\(id\)\)/u)
assert.match(getResumeByIdSource, /\.maybeSingle\(\)/u)
assert.doesNotMatch(getResumeByIdSource, /\.single\(\)/u)
assert.match(getResumeByIdSource, /if \(!data\)[\s\S]*throw new ResumeNotFoundError\(\)/u)

const cloudConfigSource = readSource('../src/lib/supabase/resume/config.ts')
assert.match(cloudConfigSource, /if \(!isCloudResumeId\(resumeId\)\)[\s\S]*throw new ResumeNotFoundError\(\)/u)

const resumeAccessSource = readSource('../src/lib/resume-access.ts')
assert.match(resumeAccessSource, /if \(isOfflineResumeId\(resumeId\)\)[\s\S]*getOfflineResumeById\(resumeId\)/u)
assert.match(resumeAccessSource, /getAccessibleResumeById/u)
assert.match(resumeAccessSource, /updateAccessibleResumeMeta/u)
assert.match(resumeAccessSource, /deleteAccessibleResume/u)

const resumeToolSource = readSource('../src/lib/ai/tools/resume.ts')
assert.match(resumeToolSource, /listAccessibleResumes\(\)/u)
assert.match(resumeToolSource, /getAccessibleResumeById\(String\(args\.resumeId\)\)/u)
assert.match(resumeToolSource, /current = await getAccessibleResumeById\(currentId\)/u)
assert.doesNotMatch(resumeToolSource, /getResumeById/u)

const crudToolSource = readSource('../src/lib/ai/tools/crud.ts')
assert.match(crudToolSource, /updateAccessibleResumeMeta\(resumeId, patch\)/u)
assert.match(crudToolSource, /deleteAccessibleResume\(resumeId\)/u)
assert.match(crudToolSource, /const resume = await getAccessibleResumeById\(resumeId\)/u)
assert.match(crudToolSource, /if \(isOfflineResumeId\(resumeId\)\)[\s\S]*本地简历暂不支持历史版本/u)

const miscToolSource = readSource('../src/lib/ai/tools/misc.ts')
const variantToolSource = readSection(miscToolSource, 'name: \'get_variant_tree\'', 'name: \'list_templates\'')
assert.match(variantToolSource, /if \(isOfflineResumeId\(resumeId\)\)[\s\S]*fetchVariantTree\(resumeId\)/u)

const contextSource = readSource('../src/lib/ai/agent/build-context.ts')
assert.match(contextSource, /accessibleResumes = await listAccessibleResumes\(\)/u)
assert.match(contextSource, /accessibleResumes\.find\(resume => resume\.resume_id === currentId\)/u)

const composerContextSource = readSource('../src/pages/assistant/hooks/use-composer-context.ts')
assert.match(composerContextSource, /const rows = await listAccessibleResumes\(\)/u)
assert.doesNotMatch(composerContextSource, /getAllResumesFromUser/u)

const canvasSource = readSource('../src/pages/assistant/hooks/use-canvas-preview.ts')
assert.match(canvasSource, /listAccessibleResumes\(\)/u)
assert.match(canvasSource, /getAccessibleResumeById\(previewResumeId\)/u)
assert.match(canvasSource, /if \(optionsStatus !== 'ready' \|\| optionsLoadedForCurrentId !== currentResumeId\)[\s\S]*return/u)
assert.match(canvasSource, /optionsLoadedForCurrentId !== currentResumeId/u)
assert.match(canvasSource, /clearCurrentResume\(\)/u)
assert.doesNotMatch(canvasSource, /getResumeById/u)

const resumeListSource = readSource('../src/pages/resume/store/resume-list.ts')
assert.match(resumeListSource, /function clearDeletedCurrentResume/u)
assert.match(resumeListSource, /clearDeletedCurrentResume\(id\)/u)

const syncServiceSource = readSource('../src/store/resume/helpers/sync-service.ts')
assert.match(syncServiceSource, /resumeExists: isResumeNotFoundError\(error\) \? false : null/u)

const documentSliceSource = readSource('../src/store/resume/slices/document.ts')
const existenceGuardIndex = documentSliceSource.indexOf('initialCloudAppearanceResult?.resumeExists === false')
const managerInitializeIndex = documentSliceSource.indexOf('manager = new DocumentManager')
assert.ok(existenceGuardIndex >= 0 && existenceGuardIndex < managerInitializeIndex)
assert.match(documentSliceSource, /options\?\.documentUrl[\s\S]*\? null[\s\S]*: await getCloudAppearanceSource\(resumeId\)/u)

const resumeLoaderSource = readSource('../src/pages/resume/editor/hooks/use-resume-loader.ts')
assert.match(resumeLoaderSource, /if \(isResumeNotFoundError\(error\)[\s\S]*clearCurrentResume\(\)/u)

const versionTimelineSource = readSource('../src/pages/assistant/components/assistant-canvas/version-timeline/index.tsx')
assert.match(versionTimelineSource, /disabled=\{isOfflineResume\}/u)

stdout.write('AI resume tool boundary verification passed.\n')
