import {
  adjustStyleForDark,
  parseDiscussHtml,
  type DiscussCssStyle,
  type DiscussHtmlElement,
  type DiscussHtmlNode,
} from '@altuu/core';
import { Text, useIsDark } from '@altuu/ui';
import { Image } from 'expo-image';
import { Fragment, useMemo, type ReactNode } from 'react';
import { Linking, Pressable, View, type TextStyle } from 'react-native';

import { openInAppBrowser } from '../../shell';

const BASE_FONT_SIZE = 14;
const KEYWORD_SIZES: Record<string, number> = {
  'xx-small': 9,
  'x-small': 10,
  small: 12,
  medium: BASE_FONT_SIZE,
  large: 18,
  'x-large': 24,
  'xx-large': 32,
  larger: 17,
  smaller: 12,
};
type MutableTextStyle = { -readonly [K in keyof TextStyle]: TextStyle[K] };

const INLINE_BREAKING = new Set(['img', 'audio', 'video']);

export interface PostHtmlProps {
  /** Sanitised post HTML (`discuss.listPosts` already runs the purifier). */
  html: string;
  onOpenImage?: (source: { uri: string }, alt: string | null) => void;
  onOpenLink?: (href: string) => void;
}

interface RenderContext {
  isDark: boolean;
  onOpenImage?: PostHtmlProps['onOpenImage'];
  onOpenLink: (href: string) => void;
}

/** Opens http(s) links in the in-app browser and mailto / tel externally. */
export function openPostLink(href: string): void {
  if (/^https?:\/\//i.test(href)) {
    openInAppBrowser(href);
  } else if (/^(mailto|tel):/i.test(href)) {
    void Linking.openURL(href).catch(() => undefined);
  }
}

/**
 * Native renderer for sanitised post HTML.
 *
 * Posts are short and the purifier leaves only div / p / lists / inline
 * formatting / img / audio / video, so a native tree beats a WebView per post
 * (a long thread would mean dozens of web views, async height measurement and
 * no native text selection). The material screen keeps its WebView because
 * material pages carry arbitrary tables and layout.
 */
export function PostHtml({
  html,
  onOpenImage,
  onOpenLink = openPostLink,
}: PostHtmlProps) {
  const isDark = useIsDark();
  const nodes = useMemo(() => parseDiscussHtml(html), [html]);
  const context: RenderContext = { isDark, onOpenImage, onOpenLink };

  return <View>{renderBlocks(nodes, context, {}, 'root')}</View>;
}

/** Maps the purifier's CSS subset to a React Native text style. */
export function toTextStyle(
  style: DiscussCssStyle,
  isDark: boolean,
): TextStyle {
  const css = isDark ? adjustStyleForDark(style) : style;
  const result: MutableTextStyle = {};

  if (css.color !== undefined) {
    result.color = css.color;
  }

  if (css['background-color'] !== undefined) {
    result.backgroundColor = css['background-color'];
  }

  const fontSize = parseFontSize(css['font-size']);

  if (fontSize !== undefined) {
    result.fontSize = fontSize;
  }

  const weight = css['font-weight'];

  if (weight !== undefined) {
    const numeric = Number(weight);

    result.fontWeight =
      weight === 'bold' ||
      weight === 'bolder' ||
      (!Number.isNaN(numeric) && numeric >= 600)
        ? '700'
        : '400';
  }

  if (css['font-style'] !== undefined) {
    result.fontStyle = css['font-style'] === 'normal' ? 'normal' : 'italic';
  }

  if (css['text-decoration'] !== undefined) {
    const decoration = css['text-decoration'];

    result.textDecorationLine =
      decoration === 'none'
        ? 'none'
        : decoration.includes('underline') &&
            decoration.includes('line-through')
          ? 'underline line-through'
          : decoration.includes('line-through')
            ? 'line-through'
            : 'underline';
  }

  if (css['text-align'] !== undefined) {
    result.textAlign = css['text-align'] as TextStyle['textAlign'];
  }

  return result;
}

function parseFontSize(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value in KEYWORD_SIZES) {
    return KEYWORD_SIZES[value];
  }

  const match = /^([\d.]+)(px|pt|em|rem|%|in|cm|mm|pc|ex|ch|vw|vh)?$/.exec(
    value,
  );

  if (match === null) {
    return undefined;
  }

  const amount = parseFloat(match[1]);

  switch (match[2]) {
    case 'px':
      return amount;
    case 'pt':
      return (amount * 4) / 3;
    case 'em':
    case 'rem':
      return amount * BASE_FONT_SIZE;
    case '%':
      return (amount / 100) * BASE_FONT_SIZE;
    default:
      return undefined;
  }
}

function parsePaddingLeft(value: string | undefined): number {
  const match = /^([\d.]+)(px|em|rem)?$/.exec(value ?? '');

  if (match === null) {
    return 0;
  }

  const amount = parseFloat(match[1]);

  return match[2] === 'em' || match[2] === 'rem'
    ? amount * BASE_FONT_SIZE
    : amount;
}

function isBlockLike(node: DiscussHtmlNode): boolean {
  if (node.type !== 'element') {
    return false;
  }

  return (
    ['div', 'p', 'ul', 'ol', 'li'].includes(node.tag) ||
    INLINE_BREAKING.has(node.tag) ||
    node.children.some(isBlockLike)
  );
}

function renderBlocks(
  nodes: DiscussHtmlNode[],
  context: RenderContext,
  inherited: TextStyle,
  keyPrefix: string,
): ReactNode[] {
  const blocks: ReactNode[] = [];
  let run: DiscussHtmlNode[] = [];

  const flushRun = (): void => {
    const hasContent = run.some(
      (node) => node.type !== 'text' || node.text.trim() !== '',
    );

    if (hasContent) {
      const index = blocks.length;

      blocks.push(
        <Text
          key={`${keyPrefix}-run-${index}`}
          selectable
          style={[{ fontSize: BASE_FONT_SIZE }, inherited]}
          className="text-sm leading-5 text-theme-900 dark:text-zinc-100"
        >
          {run.map((node, runIndex) =>
            renderInline(node, context, `${keyPrefix}-${index}-${runIndex}`),
          )}
        </Text>,
      );
    }

    run = [];
  };

  nodes.forEach((node, index) => {
    if (!isBlockLike(node)) {
      run.push(node);

      return;
    }

    flushRun();
    blocks.push(
      renderBlock(
        node as DiscussHtmlElement,
        context,
        inherited,
        `${keyPrefix}-${index}`,
      ),
    );
  });

  flushRun();

  return blocks;
}

function renderBlock(
  element: DiscussHtmlElement,
  context: RenderContext,
  inherited: TextStyle,
  key: string,
): ReactNode {
  switch (element.tag) {
    case 'img':
      return renderImage(element, context, key);
    case 'audio':
    case 'video':
      return renderMedia(element, context, key);
    case 'ul':
    case 'ol':
      return (
        <View
          key={key}
          className="mt-1"
          style={{
            paddingLeft: parsePaddingLeft(element.style['padding-left']),
          }}
        >
          {renderListItems(element, context, inherited, key)}
        </View>
      );
    default: {
      const style = {
        ...inherited,
        ...toTextStyle(element.style, context.isDark),
      };
      const paddingLeft = parsePaddingLeft(element.style['padding-left']);

      return (
        <View
          key={key}
          className={element.tag === 'p' ? 'mt-1' : undefined}
          style={paddingLeft > 0 ? { paddingLeft } : undefined}
        >
          {renderBlocks(element.children, context, style, key)}
        </View>
      );
    }
  }
}

function renderListItems(
  list: DiscussHtmlElement,
  context: RenderContext,
  inherited: TextStyle,
  keyPrefix: string,
): ReactNode[] {
  let number = 0;

  return list.children.flatMap((child, index) => {
    if (child.type !== 'element' || child.tag !== 'li') {
      return [];
    }

    number += 1;

    return [
      <View key={`${keyPrefix}-li-${index}`} className="flex-row gap-2">
        <Text className="text-sm leading-5">
          {list.tag === 'ol' ? `${number}.` : '•'}
        </Text>
        <View className="min-w-0 flex-1">
          {renderBlocks(
            child.children,
            context,
            {
              ...inherited,
              ...toTextStyle(child.style, context.isDark),
            },
            `${keyPrefix}-li-${index}`,
          )}
        </View>
      </View>,
    ];
  });
}

function renderImage(
  element: DiscussHtmlElement,
  context: RenderContext,
  key: string,
): ReactNode {
  const uri = element.attributes.src;

  if (!uri) {
    return null;
  }

  const alt = element.attributes.alt ?? null;
  const width = Number(element.attributes.width);
  const height = Number(element.attributes.height);
  const hasSize = width > 0 && height > 0;

  return (
    <Pressable
      key={key}
      accessibilityRole="imagebutton"
      accessibilityLabel={alt ?? '圖片'}
      onPress={() => context.onOpenImage?.({ uri }, alt)}
      className="my-1 self-start"
    >
      <Image
        source={{ uri }}
        accessibilityLabel={alt ?? undefined}
        contentFit="contain"
        style={
          hasSize
            ? {
                width: Math.min(width, 320),
                aspectRatio: width / height,
                maxWidth: '100%',
              }
            : { width: 240, height: 180 }
        }
      />
    </Pressable>
  );
}

function renderMedia(
  element: DiscussHtmlElement,
  context: RenderContext,
  key: string,
): ReactNode {
  const source = element.children.find(
    (child): child is DiscussHtmlElement =>
      child.type === 'element' && child.tag === 'source',
  );
  const src = element.attributes.src ?? source?.attributes.src;
  const label = element.tag === 'video' ? '播放影片' : '播放音訊';

  if (!src) {
    return null;
  }

  return (
    <Pressable
      key={key}
      accessibilityRole="link"
      onPress={() => context.onOpenLink(src)}
      className="my-1 self-start rounded-lg border border-theme-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
    >
      <Text className="text-sm text-theme-700 underline dark:text-zinc-300">
        {label}
      </Text>
    </Pressable>
  );
}

function renderInline(
  node: DiscussHtmlNode,
  context: RenderContext,
  key: string,
): ReactNode {
  if (node.type === 'text') {
    return <Fragment key={key}>{node.text}</Fragment>;
  }

  if (node.tag === 'br') {
    return <Fragment key={key}>{'\n'}</Fragment>;
  }

  const children = node.children.map((child, index) =>
    renderInline(child, context, `${key}-${index}`),
  );
  const style: MutableTextStyle = toTextStyle(node.style, context.isDark);

  switch (node.tag) {
    case 'b':
    case 'strong':
      style.fontWeight = '700';
      break;
    case 'i':
    case 'em':
      style.fontStyle = 'italic';
      break;
    case 'u':
      style.textDecorationLine = 'underline';
      break;
    case 'a': {
      const href = node.attributes.href;

      return (
        <Text
          key={key}
          style={style}
          accessibilityRole={href ? 'link' : undefined}
          onPress={href ? () => context.onOpenLink(href) : undefined}
          className="text-theme-600 underline dark:text-theme-300"
        >
          {children}
        </Text>
      );
    }
  }

  return (
    <Text key={key} style={style}>
      {children}
    </Text>
  );
}
