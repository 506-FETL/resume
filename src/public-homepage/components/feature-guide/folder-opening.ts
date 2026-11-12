import gsap from 'gsap'

const ease = gsap.parseEase('sine.inOut')
const mix = gsap.utils.interpolate

function phase(progress: number, start: number, end: number) {
  return ease(gsap.utils.clamp(0, 1, (progress - start) / (end - start)))
}

export function createFolderOpening(track: HTMLElement, reduced: boolean) {
  const runway = track.previousElementSibling as HTMLElement
  const hero = runway.querySelector<HTMLElement>('.home-hero')!
  const origin = hero.querySelector<SVGSVGElement>('.cover-origin')!
  const dividers = hero.querySelector<HTMLElement>('.cover-dividers')!
  const frame = track.querySelector<HTMLElement>('.story-frame')!
  const drawing = track.querySelector<HTMLElement>('.story-drawing')!
  const desk = track.querySelector<SVGSVGElement>('.story-drawing > svg')!
  const back = desk.querySelector<SVGGElement>('[data-cover-back]')!
  const front = desk.querySelector<SVGGElement>('[data-cover-front]')!
  const fold = desk.querySelector<SVGGElement>('[data-pocket-fold]')!
  const hands = front.querySelector<SVGGElement>('[data-pocket-hands]')!
  const gussets = back.querySelector<SVGGElement>('[data-pocket-gussets]')!

  const coverCopy = hero.querySelectorAll<HTMLElement>(
    '.cover-mastline, .home-intro',
  )

  const captions = track.querySelector<HTMLElement>('.story-captions')!
  const sheet = desk.querySelector<SVGGElement>('[data-paper-travel]')!
  const mask = desk.querySelector<SVGRectElement>('[data-pocket-mask]')!
  const tools = desk.querySelector<SVGGElement>('[data-desk-tools]')!
  const stack = desk.querySelector<SVGGElement>('[data-template-stack]')!

  let layout: {
    cover: DOMMatrix
    page: DOMMatrix
    runwayTop: number
    guideTop: number
    handoff: number
    end: number
    heroHeight: number
    frameHeight: number
    flowLeft: number
    flowTop: number
    fixedLeft: number
    fixedTop: number
  }

  let fixed = false

  function draw(progress: number, scrollY: number) {
    const nextFixed = !reduced && scrollY < layout.handoff

    if (nextFixed !== fixed) {
      fixed = nextFixed

      // 在工作簿已固定的区间内交接，避免倒滑时画布先随页面移动一帧。
      Object.assign(desk.style, {
        position: fixed ? 'fixed' : 'absolute',
        left: `${fixed ? layout.fixedLeft : layout.flowLeft}px`,
        top: `${fixed ? layout.fixedTop : layout.flowTop}px`,
      })
    }

    const time = reduced ? Number(progress >= 0.56) : progress
    const open = phase(time, 0.32, 0.54)
    const pull = phase(time, 0.36, 0.72)
    const folderOpacity = 1 - phase(time, 0.66, 0.88)

    const copyOpacity = 1 - phase(time, 0.2, 0.48)
    const tabOpacity = 1 - phase(time, 0.12, 0.24)

    if (time < 1) positionArtwork(time, open, pull, scrollY)
    else sheet.removeAttribute('transform')

    coverCopy.forEach((element) => {
      element.style.opacity = String(copyOpacity)
      element.style.visibility = copyOpacity ? 'visible' : 'hidden'
    })

    dividers.style.opacity = String(tabOpacity)
    dividers.style.visibility = tabOpacity ? 'visible' : 'hidden'
    captions.style.opacity = String(phase(time, 0.82, 1))
    gussets.style.opacity = String(open)
    back.style.opacity = front.style.opacity = String(folderOpacity)
    front.style.visibility = back.style.visibility = folderOpacity
      ? 'visible'
      : 'hidden'
    tools.style.opacity = stack.style.opacity = String(phase(time, 0.76, 1))

    mask.setAttribute(
      'height',
      String(294 + 140 * pull + 40 * phase(time, 0.72, 0.88)),
    )
  }

  function positionArtwork(
    time: number,
    open: number,
    pull: number,
    scrollY: number,
  ) {
    const land = phase(time, 0.58, 0.97)
    const restTop = Math.min(0, layout.frameHeight - layout.heroHeight)
    const coverTop = Math.max(layout.runwayTop - scrollY, restTop)

    const heroTop = reduced
      ? Math.min(coverTop, layout.guideTop - scrollY - layout.heroHeight)
      : coverTop

    const cover = new DOMMatrix().translate(0, heroTop).multiply(layout.cover)

    const frameTop = fixed
      ? 0
      : Math.min(Math.max(0, layout.guideTop - scrollY), layout.end - scrollY)

    const page = new DOMMatrix().translate(0, frameTop).multiply(layout.page)

    const toPage = page.inverse()
    const coverScale = Math.hypot(cover.a, cover.b)
    const carry = phase(time, 0, 0.32)

    const travel =
      Math.min(185, (layout.frameHeight * 0.12) / coverScale) * carry

    const carried = cover.translate(0, travel)
    const retreat = phase(time, 0.62, 0.88)

    const carrier = toPage
      .multiply(carried)
      .translate(68 * retreat, 185 * retreat)
      .rotate(4 * retreat)

    // 纸和袋先共用下移基准，停稳后才抽纸；交接前不提前追向内页。
    const start = new DOMPoint(285, 280 - 184 * pull).matrixTransform(carried)
    const end = new DOMPoint(320, 213).matrixTransform(page)
    const x = mix(start.x, end.x, land)
    const scale = mix(coverScale * 1.25, page.a, land)
    const clearance = Math.min(layout.frameHeight * 0.55, 206 * scale + 18)
    const liftedY = mix(start.y, Math.max(start.y, clearance), pull)
    const y = mix(liftedY, end.y - frameTop, land)
    const tilt = (Math.atan2(cover.b, cover.a) * 180) / Math.PI - 5 * pull

    const sheetPose = new DOMMatrix()
      .translate(x, y)
      .rotate(tilt * (1 - land))
      .scale(scale)
      .translate(-320, -213)

    back.setAttribute('transform', carrier.toString())
    front.setAttribute('transform', carrier.toString())

    dividers.style.transform = `translateY(${travel * coverScale}px)`
    hands.setAttribute('transform', `translate(${10 * open} ${46 * open})`)

    fold.setAttribute(
      'transform',
      `translate(0 353) skewX(${-10 * open}) scale(${1 + 0.025 * open} ${1 - 0.57 * open}) translate(0 -353)`,
    )

    sheet.setAttribute('transform', toPage.multiply(sheetPose).toString())
  }

  function refreshLayout() {
    const bounds = drawing.getBoundingClientRect()
    const frameBounds = frame.getBoundingClientRect()
    const scale = Math.min(bounds.width / 640, bounds.height / 450)
    const insetX = (bounds.width - 640 * scale) / 2
    const insetY = (bounds.height - 450 * scale) / 2
    const left = Math.min(0, frameBounds.left - bounds.left)
    const top = frameBounds.top - bounds.top - runway.offsetHeight
    const width = Math.max(bounds.width, frameBounds.right - bounds.left) - left
    const height = frameBounds.bottom - bounds.top - top

    // Safari 回滚时会漏绘 SVG 视口外的内容；画布覆盖封面到内页，保持原坐标与比例。
    desk.setAttribute(
      'viewBox',
      `${(left - insetX) / scale} ${(top - insetY) / scale} ${width / scale} ${height / scale}`,
    )

    Object.assign(desk.style, {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    })

    fixed = false
    hero.style.setProperty('--cover-height', `${hero.offsetHeight}px`)

    const scrollY = window.scrollY
    const guideTop = track.getBoundingClientRect().top + scrollY

    // 滚动帧只按 sticky 的位置换算矩阵，避免写入 SVG 后再读取布局。
    layout = {
      cover: new DOMMatrix()
        .translate(0, -hero.getBoundingClientRect().top)
        .multiply(measureViewport(origin)),
      page: new DOMMatrix()
        .translate(0, -frameBounds.top)
        .multiply(measureViewport(desk)),
      runwayTop: runway.getBoundingClientRect().top + scrollY,
      guideTop,
      handoff: guideTop + frame.clientHeight / 2,
      end: guideTop + track.offsetHeight - frame.offsetHeight,
      heroHeight: hero.offsetHeight,
      frameHeight: frame.clientHeight,
      flowLeft: left,
      flowTop: top,
      fixedLeft: bounds.left + left,
      fixedTop: bounds.top - frameBounds.top + top,
    }
  }

  return {
    draw,
    refreshLayout,
    handoff: () => layout.handoff,
    start: () =>
      runway.offsetTop + Math.max(0, hero.offsetHeight - window.innerHeight),
  }
}

function measureViewport(svg: SVGSVGElement) {
  const matrix = DOMMatrix.fromMatrix(svg.getScreenCTM()!)
  const bounds = svg.getBoundingClientRect()
  const viewBox = svg.viewBox.baseVal
  const x = viewBox.x + viewBox.width / 2
  const y = viewBox.y + viewBox.height / 2

  // WebKit 会误算旋转祖先下滚动后的平移；用实际视口中心还原。
  matrix.e = bounds.left + bounds.width / 2 - matrix.a * x - matrix.c * y
  matrix.f = bounds.top + bounds.height / 2 - matrix.b * x - matrix.d * y

  return matrix
}
