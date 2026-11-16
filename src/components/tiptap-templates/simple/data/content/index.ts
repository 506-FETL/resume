import gettingStarted from './getting-started.json'
import features from './features.json'
import customization from './customization.json'

const content = {
  type: 'doc',
  content: [...gettingStarted, ...features, ...customization],
}

export default content
