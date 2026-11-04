const sequence = [
  { id: 'templates', title: '选模板', pose: 0.76, beats: 1 },
  { id: 'review', title: '简历优化', pose: 1.98, beats: 2.8 },
  { id: 'assistant', title: 'AI 助手', pose: 2.95, beats: 2.25 },
  { id: 'collaboration', title: '实时协作', pose: 3.84, beats: 1.6 },
  { id: 'history', title: '历史版本', pose: 4.84, beats: 1 },
  { id: 'sharing', title: '分享简历', pose: 5.84, beats: 1 },
  { id: 'delivery', title: '记录投递', pose: 6.91, beats: 1 },
  { id: 'followup', title: '投递跟进', pose: 7.88, beats: 1 },
] as const

export const chapters = sequence.map((chapter, index) => {
  const start = sequence
    .slice(0, index)
    .reduce((sum, previous) => sum + previous.beats, 0)

  return {
    ...chapter,
    start,
    end: start + chapter.beats,
    anchor: start + (chapter.pose - index) * chapter.beats,
  }
})

export const totalBeats = chapters[chapters.length - 1].end
