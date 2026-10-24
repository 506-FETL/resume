import type {
  Gender,
  MaritalStatus,
  PoliticalStatus,
  WorkYears,
} from '@/lib/schema'

export const genderOptions: Gender[] = ['不填', '男', '女', '其他']

export const workYearsOptions: WorkYears[] = [
  '不填',
  '应届',
  '1年',
  '2年',
  '3-5年',
  '5-10年',
  '10年以上',
]

export const maritalStatusOptions: MaritalStatus[] = [
  '不填',
  '未婚',
  '已婚',
  '离异',
  '已婚已育',
]

export const politicalStatusOptions: PoliticalStatus[] = [
  '不填',
  '中共党员',
  '中共预备党员',
  '共青团员',
  '群众',
  '其他',
]
