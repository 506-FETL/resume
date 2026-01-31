import type { ApplicationStatus, JobApplication } from '../../types'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { APPLICATION_STATUS_ORDER } from '../../const'

interface AddJobDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (job: Omit<JobApplication, 'id' | 'created_at'>) => void
}

export function AddJobDrawer({ open, onOpenChange, onAdd }: AddJobDrawerProps) {
  const [formData, setFormData] = useState({
    position: '',
    company: '',
    location: '',
    status: 'saved' as ApplicationStatus,
    job_url: '',
    salary: '',
    resume_id: null as string | null,
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    if (!formData.position.trim()) {
      toast.error('请填写职位名称')
      return
    }
    if (!formData.company.trim()) {
      toast.error('请填写公司名称')
      return
    }
    if (!formData.location.trim()) {
      toast.error('请填写工作地点')
      return
    }

    const jobData: Omit<JobApplication, 'id' | 'created_at'> = {
      user_id: 'mock-user',
      resume_id: formData.resume_id,
      company: formData.company,
      company_logo: null,
      position: formData.position,
      location: formData.location,
      salary: formData.salary || null,
      job_url: formData.job_url || null,
      status: formData.status,
      stage_details: [{ stage: formData.status, status: '待处理', start_date: null, notes: '' }],
      applied_date: formData.status === 'applied' ? new Date().toISOString().split('T')[0] : null,
      notes: null,
    }

    onAdd(jobData)

    // 重置表单
    setFormData({
      position: '',
      company: '',
      location: '',
      status: 'saved',
      job_url: '',
      salary: '',
      resume_id: null,
    })
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto rounded-l-2xl p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle>Add Application</SheetTitle>
        </SheetHeader>
        <div className="p-6 space-y-5">
          {/* Position Title */}
          <div className="space-y-2">
            <Label>
              Position Title
              {' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Title"
              value={formData.position}
              onChange={e => handleChange('position', e.target.value)}
            />
          </div>
          {/* Company */}
          <div className="space-y-2">
            <Label>
              Company
              {' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Company"
              value={formData.company}
              onChange={e => handleChange('company', e.target.value)}
            />
          </div>
          {/* Location + Job Status (2列) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Location
                {' '}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Location"
                value={formData.location}
                onChange={e => handleChange('location', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Job Status
                {' '}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.status}
                onValueChange={v => handleChange('status', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUS_ORDER.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* JD URL */}
          <div className="space-y-2">
            <Label>JD URL</Label>
            <Input
              placeholder="https://..."
              value={formData.job_url}
              onChange={e => handleChange('job_url', e.target.value)}
            />
          </div>
          {/* Salary */}
          <div className="space-y-2">
            <Label>Salary</Label>
            <Input
              placeholder="e.g. $150k - $200k"
              value={formData.salary}
              onChange={e => handleChange('salary', e.target.value)}
            />
          </div>
          {/* Resume Select */}
          <div className="space-y-2">
            <Label>Resume Uploaded</Label>
            <Select
              value={formData.resume_id || ''}
              onValueChange={v => handleChange('resume_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a resume" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">my first job (Default)</SelectItem>
                <SelectItem value="resume-1">Resume 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="p-6 pt-4 border-t flex-row gap-3">
          <Button variant="outline" className="flex-1 h-11" onClick={handleCancel}>
            Cancel
          </Button>
          <Button className="flex-1 h-11" onClick={handleSubmit}>
            Add
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
