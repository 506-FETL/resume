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

  function draw(progress: number) {
    const time = reduced ? Number(progress >= 0.56) : progress
    const open = phase(time, 0, 0.34)
    const pull = phase(time, 0.12, 0.55)
    const folderOpacity = 1 - phase(time, 0.48, 0.7)

    const copyOpacity = 1 - phase(time, 0.2, 0.48)
    const tabOpacity = 1 - phase(time, 0.13, 0.32)

    if (time < 1) positionArtwork(time, open, pull)
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
    mask.setAttribute('height', String(294 + 180 * pull))
  }

  function positionArtwork(time: number, open: number, pull: number) {
    const land = phase(time, 0.36, 0.97)
    const restTop = Math.min(0, frame.clientHeight - hero.offsetHeight)

    const slip = reduced
      ? 0
      : Math.max(0, restTop - hero.getBoundingClientRect().top)

    const cover = new DOMMatrix()
      .translate(0, slip)
      .multiply(origin.getScreenCTM()!)

    const page = DOMMatrix.fromMatrix(desk.getScreenCTM()!)
    const toPage = page.inverse()
    const frameTop = frame.getBoundingClientRect().top
    const pocket = toPage.multiply(cover)
    const retreat = phase(time, 0.32, 0.72)

    const carrier = pocket
      .translate(68 * retreat, 185 * retreat)
      .rotate(4 * retreat)

    // 纸的中心从夹袋坐标移到内页坐标。先抽出下沿，再转向工作簿。
    const start = new DOMPoint(285, 280 - 184 * pull).matrixTransform(cover)
    const end = new DOMPoint(320, 213).matrixTransform(page)
    const x = mix(start.x, end.x, land)
    const scale = mix(Math.hypot(cover.a, cover.b) * 1.25, page.a, land)
    const clearance = Math.min(frame.clientHeight * 0.55, 206 * scale + 18)
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
    hands.setAttribute('transform', `translate(${10 * open} ${46 * open})`)

    fold.setAttribute(
      'transform',
      `translate(0 353) skewX(${-10 * open}) scale(${1 + 0.025 * open} ${1 - 0.57 * open}) translate(0 -353)`,
    )

    sheet.setAttribute('transform', toPage.multiply(sheetPose).toString())
  }

  return {
    draw,
    refreshLayout: () =>
      hero.style.setProperty('--cover-height', `${hero.offsetHeight}px`),
    start: () =>
      Math.max(0, runway.offsetTop + hero.offsetHeight - window.innerHeight),
  }
}
