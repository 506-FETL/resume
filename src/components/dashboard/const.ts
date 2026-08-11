import { Axe, FileUser, FolderKanban, History, HomeIcon, LayoutTemplate, PencilRuler, Settings, Share2 } from 'lucide-react'

export const Data = {
  modules: [
    {
      title: '首页',
      url: '/',
      icon: HomeIcon,
    },
    {
      title: '我的简历',
      url: '/resume',
      icon: FileUser,
    },
    {
      title: '分享管理',
      url: '/share',
      icon: Share2,
    },
    {
      title: '求职看板',
      url: '/tracker',
      icon: FolderKanban,
    },
    {
      title: '简历模板',
      url: '/template',
      icon: LayoutTemplate,
    },
    {
      title: '简历优化',
      url: '/optimize',
      icon: PencilRuler,
    },
    {
      title: '历史版本',
      url: '/history',
      icon: History,
    },
  ],
  navSecondary: [
    {
      title: '设置',
      url: '/settings',
      icon: Settings,
    },
    {
      title: '更新日志',
      url: '/changelog',
      icon: Axe,
    },
  ],
}
