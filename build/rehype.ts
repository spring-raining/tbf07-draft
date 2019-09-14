import u from 'unist-builder'
import all from 'mdast-util-to-hast/lib/all'

const ext = /\.[^\.]+$/
const whitespace = /\s/g
const specials = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~’]/g

function figId(path: string, maintainCase = true) {
  if (typeof path !== 'string') return null
  if (!maintainCase) path = path.toLowerCase()

  return path
    .trim()
    .replace(ext, '')
    .replace(specials, '')
    .replace(whitespace, '-')
}

/**
 * Process `code` on `remark-rehype`.
 * `mdast-util-to-hast` By default, the language is not specified as `<pre>`, so it is handled independently.
 * @param h Processer of HAST.
 * @param node Node of HAST.
 * @returns HAST.
 * @see https://github.com/syntax-tree/mdast-util-to-hast/blob/master/lib/handlers/code.js
 */
export const code = (h: any, node: any) => {
  const value = node.value || ''
  const lang = node.lang ? node.lang.match(/^[^ \t]+(?=[ \t]|$)/) : 'text'

  // `Prism.js` also requires language specification for `<pre>`
  const props = { className: ['language-' + lang] }
  return h(node.position, 'pre', props, [
    h(node, 'code', props, [u('text', value)])
  ])
}

/**
 * Process `crossref` on `remark-rehype`..
 * @param h Processer of HAST.
 * @param node Node of HAST.
 * @returns HAST.
 */
export const crossReference = (h: any, node: any) => {
  return node.identifiers
    .map((ident: string) => /^(\w+):(\S+)$/.exec(ident))
    .filter((match: string[]) => match)
    .map((match: string[]) =>
      h(
        node,
        'a',
        {
          href: `#${match[2]}`,
          className: 'crossref',
          'data-ref': match[1]
        },
        []
      )
    )
}

/**
 * Process `image` on `remark-rehype`..
 * @param h Processer of HAST.
 * @param node Node of HAST.
 * @returns HAST.
 */
export const image = (h: any, node: any) => {
  const props = { src: node.url, alt: node.alt, title: undefined }
  if (node.title !== null && node.title !== undefined) {
    props.title = node.title
  }
  const id = figId(node.url)

  const children = [h(node, 'img', props)]
  if (props.alt) {
    children.push(h(node, 'figcaption', null, [u('text', props.alt)]))
  }

  return h(node, 'figure', { id, className: ['fig'] }, children)
}

/**
 * Process `footnote` on `remark-rehype`..
 * @param h Processer of HAST.
 * @param node Node of HAST.
 * @returns HAST.
 */
export const footnote = (h: any, node: any) => {
  return h(node, 'span', { className: ['footnote'] }, all(h, node))
}
