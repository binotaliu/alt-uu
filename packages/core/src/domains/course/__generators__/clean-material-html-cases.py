"""
Inputs for ../__goldens__/clean-material-html.golden.json. Regenerate with:
  python3 clean-material-html-cases.py   (writes cases.json in the cwd)
  php clean-material-html.php cases.json  (needs `composer install` in the
  legacy worktree; prints the cases with the real PHP output)
and wrap the printed list as {"generatedBy": ..., "cases": [...]}.
"""
import json
cases = {
 "root-blocks": "<div>a</div><div>b</div><p>c</p>",
 "root-text-then-block": "hello <b>world</b><div>block</div>tail",
 "root-double-newline": "first para\n\nsecond para\n\n\nthird",
 "div-double-newline": "<div>one\n\ntwo<b>x</b>\n\nthree</div>",
 "div-inline-after-break": "<div>intro\n\n<b>bold</b> rest<div>blk</div></div>",
 "lists": "<ul>\n<li>one</li>\n<li>two <em>em</em></li>\n<li></li>\n</ul><ol><li>x</li></ol>",
 "table-attrs": "<table border=\"1\" width=\"100%\"><thead><tr><th colspan=\"2\" style=\"color:red\">H</th></tr></thead><tbody><tr rowspan=\"2\"><td rowspan=\"2\" class=\"c\">a</td><td></td></tr></tbody><tfoot><tr><td>f</td></tr></tfoot></table>",
 "table-caption": "<table><caption>cap</caption><tr><td>a</td></tr></table>",
 "inline-block": "<span>pre<div>inner</div>post</span>",
 "a-variants": "<p><a href=\"mailto:a@b.c\">mail</a> <a href=\"javascript:alert(1)\">js</a> <a href=\"tel:123\">tel</a> <a href=\"https://other.example/x?a=1&b=2\" title=\"t\">ext</a> <a name=\"anchor\"></a> <a href=\"https://x.example/\">  </a></p>",
 "img-variants": "<p><img src=\"pic.png\"><img src=\"a.png\" alt=\"a\" width=\"50%\" height=\"2000\"><img alt=\"nosrc\"><img src=\"data:image/png;base64,AAAA\" alt=\"d\"><img src=\"https://cdn.example/x.png\" alt=\"cdn\" width=\"120px\"></p>",
 "iframe-variants": "<iframe src=\"https://www.youtube.com/embed/abc\" width=\"560\" height=\"315\" frameborder=\"0\" allowfullscreen></iframe><iframe></iframe><iframe src=\"javascript:alert(1)\"></iframe>",
 "media": "<video controls width=\"320\" height=\"240\" poster=\"p.jpg\"><source src=\"movie.mp4\" type=\"video/mp4\">Your browser</video><audio controls src=\"a.mp3\"></audio>",
 "entities": "<p>a &amp; b &lt; c &gt; d &quot;q&quot; &#39;s&#39; &nbsp;x&copy;</p>",
 "nonascii-url": "<p><img src=\"images/封面 圖.jpg\" alt=\"x\"><a href=\"files/講義 1.pdf?x=a b#frag 1\">dl</a></p>",
 "comments-and-unknown": "<!-- c --><center><font color=\"red\" face=\"x\">red</font></center><pre>code\n  block</pre><sup>2</sup><h3>Title</h3>",
 "nested-p": "<p>outer<p>inner</p>",
 "br-and-hr": "<p>line1<br>line2<br/>line3</p><hr><p>after</p>",
 "style-attrs": "<p style=\"color:red\" class=\"x\" id=\"y\" onclick=\"z()\" align=\"center\">s</p><span style=\"font-weight:bold\">b</span>",
 "empty-inline": "<p><span> </span><b></b><i>i</i></p><div><span></span></div>",
 "nbsp-only": "<p>&nbsp;</p><span>&nbsp;</span>",
 "root-whitespace-inline": "<div>x</div>\n<b>bold</b>\n<i>it</i>",
 "li-double-newline": "<ul><li>a\n\nb</li></ul>",
 "u-strong-em": "<u>u</u><strong>s</strong><em>e</em>",
 "td-double-newline": "<table><tr><td>a\n\nb</td></tr></table>",
 "deep-nesting": "<div><div><div><span>deep</span></div></div></div>",
 "headings-in-div": "<div><h1>H1</h1>\n<p>p</p>\n<h4>H4</h4></div>",
 "font-in-p": "<p><font size=\"3\">t1</font><font size=\"3\">t2</font></p>",
 "block-in-a": "<a href=\"https://x.example/\"><div>blk</div></a>",
 "b-in-b": "<b>1<b>2</b>3</b>",
 "form-input": "<form><input type=\"text\" value=\"v\"><button>btn</button><select><option>o</option></select><textarea>ta</textarea></form>",
 "object-embed": "<object data=\"x.swf\"><embed src=\"x.swf\"></object>tail",
 "relative-dots": "<p><a href=\"../../a/./b/../c.html?q=1\">r</a><a href=\"//cdn.example/y\">pr</a><a href=\"?page=2\">q</a></p>",
 "ul-text": "<ul>text<li>a</li></ul>",
 "dl": "<dl><dt>t</dt><dd>d</dd></dl>",
 "span-in-root-with-newlines": "line\n\n<span>s</span>\n\nend",
 "mixed-case-tags": "<P>Upper<BR>case</P><DIV ALIGN=\"left\">d</DIV>",
 "br-root": "a<br>b",
 "img-only-root": "<img src=\"x.png\" alt=\"x\">",
 "text-only-ws-root": "   \n  ",
 "table-in-p": "<p>before<table><tr><td>t</td></tr></table>after</p>",
 "div-text-block-text": "<div>t1<div>b</div>t2</div>",
 "strike-s-del": "<s>s</s><strike>st</strike><del>d</del><ins>i</ins><small>sm</small><big>bg</big><code>c</code><abbr>a</abbr><q>q</q><cite>c</cite><blockquote>bq</blockquote>",
 "colon-in-text": "<p>Time: 10:00 &amp;&amp; <b>bold</b>&gt;</p>",
 "quote-attr": "<p><a href=\"https://x.example/?a=&quot;b&quot;&amp;c=1\" title=\"he said &quot;hi&quot; &amp; &lt;\">q</a></p>",
 "iframe-relative": "<iframe src=\"/media/player.html\" width=\"100%\" height=\"400\"></iframe>",
 "list-empty-mid": "<ul>\n<li>one</li>\n<li></li>\n<li>two</li>\n</ul>",
 "div-empty-mid": "<div>\n<b>one</b>\n<span></span>\n<i>two</i>\n</div>",
 "div-empty-block-mid": "<div>\n<p>one</p>\n<div></div>\n<p>two</p>\n</div>",
 "root-empty-first": "<div></div><div>x</div>",
 "root-becomes-empty": "<div><span></span></div><div>x</div>",
 "video-text": "<video controls src=\"v.mp4\">fallback <b>text</b></video>",
 "span-div-span": "<div>a<span>b<div>c</div>d</span>e</div>",
 "img-noalt-query": "<p><img src=\"https://cdn.example/dir/pic.png?x=1\"></p>",
 "table-ws": "<table>\n<tr>\n<td>a</td>\n</tr>\n</table>",
 "ws-text-nested": "<div>\n  <div>\n    text\n  </div>\n</div>",
 "text-root-ws-block": "  <div>a</div>  <div>b</div>  "
}
url = "https://uu.nou.edu.tw/base/1/content/2/page.html"
out = []
for name, body in cases.items():
    out.append({"name": name, "html": "<html><body>" + body + "</body></html>", "url": url})
json.dump(out, open("cases.json","w"), ensure_ascii=False, indent=1)
