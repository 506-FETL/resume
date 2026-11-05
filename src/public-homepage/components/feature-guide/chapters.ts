const sequence = [
  { id: 'templates', title: '选模板', pose: 0.76, beats: 1 },
  { id: 'review', title: '简历优化', pose: 1.999, beats: 3.5 },
  { id: 'assistant', title: 'AI 助手', pose: 2.89, beats: 3.2 },
  { id: 'collaboration', title: '实时协作', pose: 3.91, beats: 1.9 },
  { id: 'history', title: '历史版本', pose: 4.9, beats: 1.2 },
  { id: 'sharing', title: '分享简历', pose: 5.89, beats: 1.2 },
  { id: 'delivery', title: '记录投递', pose: 6.999, beats: 1 },
  { id: 'followup', title: '投递跟进', pose: 7.999, beats: 1.4 },
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
