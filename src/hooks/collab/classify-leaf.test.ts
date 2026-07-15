import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyLeaf } from './classify-leaf.ts'

test('rich text leaves', () => {
  assert.equal(classifyLeaf('self_evaluation', 'content'), 'rich')
  assert.equal(classifyLeaf('work_experience', 'items.0.workInfo'), 'rich')
  assert.equal(classifyLeaf('skill_specialty', 'description'), 'rich')
  assert.equal(classifyLeaf('hobbies', 'description'), 'rich')
  assert.equal(classifyLeaf('honors_certificates', 'description'), 'rich')
  assert.equal(classifyLeaf('internship_experience', 'items.1.internshipInfo'), 'rich')
  assert.equal(classifyLeaf('project_experience', 'items.0.projectInfo'), 'rich')
  assert.equal(classifyLeaf('edu_background', 'items.0.eduInfo'), 'rich')
  assert.equal(classifyLeaf('campus_experience', 'items.0.campusInfo'), 'rich')
})

test('free text leaves', () => {
  assert.equal(classifyLeaf('basics', 'name'), 'freeText')
  assert.equal(classifyLeaf('basics', 'email'), 'freeText')
  assert.equal(classifyLeaf('basics', 'phone'), 'freeText')
  assert.equal(classifyLeaf('basics', 'nation'), 'freeText')
  assert.equal(classifyLeaf('basics', 'nativePlace'), 'freeText')
  assert.equal(classifyLeaf('basics', 'customFields.0.label'), 'freeText')
  assert.equal(classifyLeaf('basics', 'customFields.0.value'), 'freeText')
  assert.equal(classifyLeaf('job_intent', 'jobIntent'), 'freeText')
  assert.equal(classifyLeaf('job_intent', 'intentionalCity'), 'freeText')
  assert.equal(classifyLeaf('application_info', 'applicationSchool'), 'freeText')
  assert.equal(classifyLeaf('application_info', 'applicationMajor'), 'freeText')
  assert.equal(classifyLeaf('work_experience', 'items.2.companyName'), 'freeText')
  assert.equal(classifyLeaf('work_experience', 'items.0.position'), 'freeText')
  assert.equal(classifyLeaf('project_experience', 'items.0.projectName'), 'freeText')
  assert.equal(classifyLeaf('project_experience', 'items.0.participantRole'), 'freeText')
  assert.equal(classifyLeaf('campus_experience', 'items.0.experienceName'), 'freeText')
  assert.equal(classifyLeaf('campus_experience', 'items.0.role'), 'freeText')
  assert.equal(classifyLeaf('edu_background', 'items.0.schoolName'), 'freeText')
  assert.equal(classifyLeaf('edu_background', 'items.0.professional'), 'freeText')
  assert.equal(classifyLeaf('honors_certificates', 'certificates.0.name'), 'freeText')
  assert.equal(classifyLeaf('hobbies', 'hobbies.0.name'), 'freeText')
})

test('atomic leaves: enums, dates, numbers, unregistered', () => {
  assert.equal(classifyLeaf('edu_background', 'items.0.degree'), 'atomic') // Select enum
  assert.equal(classifyLeaf('job_intent', 'dateEntry'), 'atomic')
  assert.equal(classifyLeaf('job_intent', 'expectedSalary'), 'atomic') // number
  assert.equal(classifyLeaf('skill_specialty', 'skills.0.proficiencyLevel'), 'atomic')
  assert.equal(classifyLeaf('skill_specialty', 'skills.0.displayType'), 'atomic')
  assert.equal(classifyLeaf('skill_specialty', 'skills.0.label'), 'atomic') // display-only span
  assert.equal(classifyLeaf('work_experience', 'items.0.workDuration.1'), 'atomic')
  assert.equal(classifyLeaf('work_experience', 'items.0.workDuration'), 'atomic')
  assert.equal(classifyLeaf('basics', 'birthMonth'), 'atomic') // date string
  assert.equal(classifyLeaf('basics', 'gender'), 'atomic') // enum
  assert.equal(classifyLeaf('basics', 'heightCm'), 'atomic') // number
  assert.equal(classifyLeaf('basics', 'unknownField'), 'atomic') // unregistered
})
