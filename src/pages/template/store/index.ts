// page-level Zustand store with slices: official/user templates,
// editor (single template editing), and workbench (list/management orchestration).
// Each slice owns its own state + actions; barrel re-exports keep external import surface stable.
export { default as useTemplateEditorStore } from './editor'
export { default as useOfficialTemplatesStore } from './official-templates'
export * from './shared'
export { default as useUserTemplatesStore } from './user-templates'
export { default as useTemplateWorkbenchStore } from './workbench'
