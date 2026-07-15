import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildFragmentKey } from './fragment-key.ts'

test('section-level rich field key', () => {
  assert.equal(buildFragmentKey('self_evaluation', 'content'), 'self_evaluation.content')
  assert.equal(buildFragmentKey('hobbies', 'description'), 'hobbies.description')
  assert.equal(buildFragmentKey('honors_certificates', 'description'), 'honors_certificates.description')
  assert.equal(buildFragmentKey('skill_specialty', 'description'), 'skill_specialty.description')
})

test('array-item rich field key preserves index', () => {
  assert.equal(buildFragmentKey('work_experience', 'items.0.workInfo'), 'work_experience.items.0.workInfo')
  assert.equal(buildFragmentKey('project_experience', 'items.2.projectInfo'), 'project_experience.items.2.projectInfo')
})

test('distinct fields produce distinct keys', () => {
  assert.notEqual(
    buildFragmentKey('work_experience', 'items.0.workInfo'),
    buildFragmentKey('work_experience', 'items.1.workInfo'),
  )
  assert.notEqual(
    buildFragmentKey('self_evaluation', 'content'),
    buildFragmentKey('hobbies', 'description'),
  )
})

test('empty relative path yields section key', () => {
  assert.equal(buildFragmentKey('self_evaluation', ''), 'self_evaluation')
})
