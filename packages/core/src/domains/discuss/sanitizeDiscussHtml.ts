import { parseDocument } from 'htmlparser2';
import { purifyNodes, type PurifierProfile } from '../course/material/purifier';

/**
 * Legacy `config/purifier.php` `default` profile (what `Purifier::clean($html)`
 * used for discussion post bodies): HTML.Allowed with `style` on p / span
 * filtered through CSS.AllowedProperties, no tables / iframes, no
 * HTML.TargetBlank, AutoParagraph + RemoveEmpty.
 */
export const DISCUSS_PURIFIER_PROFILE: PurifierProfile = {
  allowed: {
    div: {},
    b: {},
    strong: {},
    i: {},
    em: {},
    u: {},
    a: { href: 'uri', title: 'text' },
    ul: {},
    ol: {},
    li: {},
    p: { style: 'style' },
    br: {},
    span: { style: 'style' },
    img: { width: 'length', height: 'length', alt: 'text', src: 'uri' },
    audio: { controls: 'bool', src: 'uri' },
    video: {
      controls: 'bool',
      src: 'uri',
      width: 'length',
      height: 'length',
    },
    source: { src: 'uri', type: 'text' },
  },
  targetBlank: false,
  cssProperties: new Set([
    'font',
    'font-size',
    'font-weight',
    'font-style',
    'font-family',
    'text-decoration',
    'padding-left',
    'color',
    'background-color',
    'text-align',
  ]),
};

/** Port of `Purifier::clean($content)` with the legacy `default` profile. */
export function sanitizeDiscussHtml(html: string): string {
  return purifyNodes(parseDocument(html).children, DISCUSS_PURIFIER_PROFILE);
}
