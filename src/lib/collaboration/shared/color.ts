function hashUserId(userId: string) {
  let hash = 2166136261
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function colorChannelToHex(channel: number) {
  return Math.round(channel * 255).toString(16).padStart(2, '0')
}

function participantHueToHex(hue: number) {
  const saturation = 0.85
  const lightness = 0.6
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const hueSection = hue / 60
  const secondary = chroma * (1 - Math.abs(hueSection % 2 - 1))
  const offset = lightness - chroma / 2

  let red = 0
  let green = 0
  let blue = 0

  if (hueSection < 1) {
    red = chroma
    green = secondary
  }
  else if (hueSection < 2) {
    red = secondary
    green = chroma
  }
  else if (hueSection < 3) {
    green = chroma
    blue = secondary
  }
  else if (hueSection < 4) {
    green = secondary
    blue = chroma
  }
  else if (hueSection < 5) {
    red = secondary
    blue = chroma
  }
  else {
    red = chroma
    blue = secondary
  }

  return `#${colorChannelToHex(red + offset)}${colorChannelToHex(green + offset)}${colorChannelToHex(blue + offset)}`
}

/** Resolve the same collaboration color for every connection owned by a login user. */
export function getParticipantColor(userId: string) {
  return participantHueToHex(hashUserId(userId) % 360)
}
