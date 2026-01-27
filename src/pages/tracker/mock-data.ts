import type { JobApplication } from './types'

export const mockApplications: JobApplication[] = [
  {
    id: '1',
    company: 'Google',
    position: 'Software Engineer',
    status: 'applied',
    location: 'San Francisco',
    appliedDate: '2022-01-01',
    savedDate: '2022-01-01',
    // source: 'LinkedIn',
    // salary: '100000',
    companyLogo: 'https://www.google.com/favicon.ico',
    notes: 'Applied for the position',
  },
  {
    id: '2',
    company: 'Microsoft',
    position: 'Software Engineer',
    status: 'applied',
    location: 'San Francisco',
    appliedDate: '2022-01-01',
    savedDate: '2022-01-01',
    // source: 'LinkedIn',
    // salary: '100000',
    companyLogo: 'https://www.microsoft.com/favicon.ico',
    notes: 'Applied for the position',
  },
  {
    id: '3',
    company: 'Apple',
    position: 'Software Engineer',
    status: 'applied',
    location: 'San Francisco',
    appliedDate: '2022-01-01',
    savedDate: '2022-01-01',
    // source: 'Linkbied
    companyLogo: 'https://www.apple.com/favicon.ico',
    notes: 'Applied for the position',
  },

]
