---
title: Remarkで広げるMarkdownの世界
author:
  - spring-raining
---

# Remarkで広げるMarkdownの世界

はじめましてこんにちは、はるさめです。本誌は名目上はVivliostyleについて紹介する同人誌なのですが、またしても空気を読まずVivliostyleではないOSSプロジェクト「**Remark**」について紹介したいと思います。

## Remark

Remarkとは「Markdown processor」という紹介文の通り、Remarkで書かれたテキストを読み込み様々な変換を施すことができるJavaScript製のライブラリです。Remarkは様々なライブラリと組み合わせて目的の形式のテキストに変換することができ、**Rehype** と一緒に使うことでMarkdownをHTMLに変換することができます。同様の処理をしてくれるライブラリとしてはMarked.jsが有名ですが、Remarkの強力な機能は、Markdownを **抽象構文木（AST）**に変換することで、より柔軟に構文を改造することができる点です。[^ Haskell製のライブラリ **Pandoc** も同様の方針で実装されたテキスト変換ツールで、様々な形式のテキストを入力・出力することができます]

なお、非常に紛らわしいのですが、GitHub上で検索すると「Remark」という名前のプロジェクトが2つ見つかります。今回紹介するプロジェクトは `gnab/remark` ではなく、`remarkjs/remark` のほうです。公式サイトも https://remarkjs.com ではなく https://remark.js.org なので気をつけてください。


## Unifiedエコシステム

Remarkをはじめとしたライブラリ群は役割ごとに細かくパッケージ化されており、それぞれの目的に応じて複数を組み合わせて用います。それぞれのパッケージは総称して **Unified** というプロジェクトに属しているのですが、各パッケージの役割が少し分かりづらいためここで整理しておきます。

- **remark/rehype** : Markdown/HTMLの構文を解析・構築する処理系。それぞれに **parse** と **stringify** の2つのパッケージがあり、**remark-parse** はMarkdownからmdastをへ変換することができ、**remark-stringify** はmdastからテキストのMarkdownを構築することができる
- **mdast/hast** : Markdown/HTMLの構文を解析して得られるASTの仕様。それぞれの仕様は **unist** という仕様を拡張して定義されており、GitHub上では `syntax-tree` というOrganizationで管理されている
- **remark-rehype/rehype-remark** : mdast（hast）からhast（mdast）に変換するパッケージ。実際の処理は **mdast-util-to-hast/hast-util-to-mdast** が実施している。
- **vfile** : ファイルのパス情報を抽象化して管理するパッケージ
- **unified** : Unifiedファミリーの複数のライブラリを合成し、処理を実行する関数を得るためのパッケージ

これらの処理をまとめた、unifiedのREADMEにある便利な図を引用します。

```
| ........................ process ........................... |
| .......... parse ... | ... run ... | ... stringify ..........|

            +--------+                     +----------+
Input ->- | Parser | ->- Syntax Tree ->- | Compiler | ->- Output
            +--------+          |          +----------+
                                X
                                |
                        +--------------+
                        | Transformers |
                        +--------------+
```

Remarkを使って文章を変換しようとする際は、`parse`、`run`、`stringify` の3つの処理を経ることになります。例えばMarkdownからHTMLへ変換する際は、**remark-parse** を使ってmdast形式に解析し、**remark-rehype** を使ってhast形式に変換した後 **rehype-stringify** でHTML形式のテキストを出力します。


## Markdownをパースしてみる

まずはRemarkを使ってMarkdownをHTMLに変換するところから始めてみます。ひとまず以下のパッケージをインストールします。[^ 以降の例ではNode.js上での実行を前提としますが、Remarkはブラウザ上でも問題無く動作します]

```
npm i -s unified remark-parse remark-rehype rehype-stringify
```

インストールしたRemarkを使って簡単なMarkdownをパースしてみます。以下のコードは、`input` にMarkdownで記述した文字列を用意しており、`processor.process()` でHTMLに変換しています。

```js
const unified = require('unified');
const markdown = require('remark-parse');
const remark2rehype = require('remark-rehype');
const html = require('rehype-stringify');

const processor = unified()
  .use(markdown)
  .use(remark2rehype)
  .use(html);
const input = `
# はじめてのRemark
**太字**_斜体_テキスト
`;
processor.process(input).then(({ contents }) => {
  console.log(contents);
});
```

このコードを実行すると、以下の出力が得られます。まさに期待した通りのHTMLです！

```html
<h1>はじめてのRemark</h1>
<p><strong>太字</strong><em>斜体</em>テキスト</p>
```

「Unifiedエコシステム」で紹介した通り、`processor` は `parse`、`run`、`stringify` を連続して実行したものです。以下のコードで、`parse` 終了時と `run` 終了時の内容を見てみましょう。

```js
const inspect = require('unist-util-inspect');

const parsed = processor.parse(input);
console.log(inspect(parsed));
const transformed = processor.runSync(parsed);
console.log(inspect(transformed));
```

2回のコンソール出力では、それぞれ以下のようにMarkdownとHTMLのASTが確認できます[^ `unist-util-inspect` はASTを分かりやすく表示させるユーティリティーです。`inspect` せずに表示させると、同じ構造を持つObjectが得られます。]。それぞれのASTについて、少し踏み込んで見ます。

### MarkdownのAST（mdast）

```
root[2] (1:1-4:1, 0-30)
├─ heading[1] (2:1-2:14, 1-14) [depth=1]
│  └─ text: "はじめてのRemark" (2:3-2:14, 3-14)
└─ paragraph[3] (3:1-3:15, 15-29)
    ├─ strong[1] (3:1-3:7, 15-21)
    │  └─ text: "太字" (3:3-3:5, 17-19)
    ├─ emphasis[1] (3:7-3:11, 21-25)
    │  └─ text: "斜体" (3:8-3:10, 22-24)
    └─ text: "テキスト" (3:11-3:15, 25-29)
```

ASTはその名の通り、木構造で構成されています。木構造とは、ノードと呼ばれる項目同士が紐付いて1つになった構造のことで、1つの根（root）ノードが1つ以上の子ノードを持ち、そのノードがまた別の子ノードを持つ…というつながりにより木のように広がる構造を持ちます。

mdastでは、葉（子ノードを持たないノード）は基本的に `text` というノードになり、`heading`（見出し）、`paragraph`（段落）のようにそれぞれの属性を表すノードが親となります。また、`heading` の `depth`（見出しの大きさ）のようにそのノード自体にも任意の情報を持たせることができます。また、各ノードの `(1:1-4:1, 0-37)` のような数字は、そのノードが元の文章の何行目・何文字目にあたるかを表しており、この情報を使って元文章に注釈をつけるといった活用ができるようになります。

### HTMLのAST（hast）

```
root[3] (1:1-4:1, 0-30)
├─ element[1] (2:1-2:14, 1-14) [tagName="h1"]
│  └─ text: "はじめてのRemark" (2:3-2:14, 3-14)
├─ text: "\n"
└─ element[3] (3:1-3:15, 15-29) [tagName="p"]
    ├─ element[1] (3:1-3:7, 15-21) [tagName="strong"]
    │  └─ text: "太字" (3:3-3:5, 17-19)
    ├─ element[1] (3:7-3:11, 21-25) [tagName="em"]
    │  └─ text: "斜体" (3:8-3:10, 22-24)
    └─ text: "テキスト" (3:11-3:15, 25-29)
```

hastも基本的な構造は同じですが、`paragraph` などの代わりに `element` というノードが用いられています。この構造を見てピンと来たかと思いますが、hastは実のところHTMLのタグの構造と全く同じです。`tagName` はそのノードが何のHTMLタグに置き換わるかを示しています。


## Parserを拡張してみる

ASTによる文章の構造化により、Remarkは要求に応じて構文を定義することが簡単にできることが特徴です。それでは、本章で実際に独自のMarkdownを作ってみます。今回はふりがなをふることができる「ルビ」を独自の構文で定義してみましょう。ルビを表現するための構文は色々と考えられますが、今回は某小説投稿サイトにしたがって以下のようなルールの構文を作ります。

- 縦棒 `｜` でルビの開始地点を表す
- 二重山括弧 `《》` の中にルビ本体を記述する

すなわち、<ruby>禁書目録<rt>インデックス</rt></ruby>を表すためには、`｜禁書目録《インデックス》` というように書く、ということになります。

Parserを拡張するためにはいくつか方法がありますが、今回はremark-parseの動作に手を加えることで実現しようと思います。まず、Markdownをmdast形式に変換する際にこの構文を正しく解析できるよう、プラグインとなる関数を用意するところから始めます。

```js
function rubyAttacher() {
  const { Parser } = this;
  if (!Parser) {
    return;
  }
  const {inlineTokenizers, inlineMethods} = Parser.prototype;
}
```

プラグイン関数中のremark-parse実装は `Parser` として定義されており、その中でもTokenizer（字句解析; 文字列を適切な箇所で区切る処理）は大別して `blockTokenizers` と `inlineTokenizers` という名前で用意されます。今回のルビを字句解析する処理は、`inlineTokenizers` に追加します。

```js
function rubyLocator(value, fromIndex) {
  return value.indexOf('｜', fromIndex);
}
function rubyTokenizer(eat, value, silent) {
  if (value.charAt(0) !== '｜') {
    return;
  }
  const rtStartIndex = value.indexOf('《');
  const rtEndIndex = value.indexOf('》', rtStartIndex);
  if (rtStartIndex <= 0 || rtEndIndex <= 0) {
    return;
  }
  const rubyRef = value.slice(1, rtStartIndex);
  const rubyText = value.slice(rtStartIndex + 1, rtEndIndex);
  if (silent) {
    return true; // Silentモードはconsumeせずtrueを返す
  }
  const now = eat.now(); // テキスト中の現在の位置を取得
  now.column += 1;
  now.offset += 1;
  return eat(value.slice(0, rtEndIndex + 1))({
    type: 'ruby',
    rubyText,
    children: this.tokenizeInline(rubyRef, now),
    data: { hName: 'ruby' },
  });
}
```

remark-parseでオリジナルの字句解析を実装するためには、**locator** と **tokenizer** の2つの関数が必要です。locatorはその文法が何文字目から始まるかを指示する関数で、tokenizerで実際に文字列を区切る処理を実装します。ここでのlocatorは、単にルビの開始地点（`｜` の位置）を返すだけの関数です。

上記のtokenizerは、`《` と `》` の位置を元にルビの対象となるテキスト `rubyRef` とルビの内容 `rubyText` を取り出す処理を書いたものです。`eat` という関数はtokenizerを読みすすめるための関数で、引数にルビとしてconsume（消費）する文字列を与えることでその分だけ字句解析を進めます。`eat` の返値は関数になっており、消費した文字列に対応するmdastのノードを与えることでASTの構文木に追加することができます。また、`now` はtokenizerの開始地点が元の文章のどの位置に対応するかを表します。参考コードのように、読み進める文字数だけ `column` と `offset`  の値を更新した上で `tokenizeInline` に与えることで、再帰的に実行されるtokenizerの位置情報を更新しています。

```js
function rubyAttacher() {
  ...
  rubyTokenizer.locator = rubyLocator;
  inlineTokenizers.ruby = rubyTokenizer;
  inlineMethods.splice(inlineMethods.indexOf('text'), 0, 'ruby');
}
```

定義したlocatorとtokenizerを利用するよう `rubyAttacher` を修正します。`inlineMethod` には適用するtokenizerの名前が配列で示されており、配列内の順番がそのままtokenizerを実行する順番（=優先順位）になります。これでプラグイン関数は完成です。[^ 参考コードの `rubyTokenizer` はとても簡単なケースにしか対応しておらず、まだまだ改善すべき点があります。例えばルビの入れ子が含まれた場合どうなるでしょうか？]

```js
const processor = unified()
  .use(markdown)
  .use(rubyAttacher)
  .use(remark2rehype)
  .use(html);
```

プラグインはunifiedのメソッドチェーンに付け加えるだけで利用することができます（順番に気をつけてください）。早速mdastへのパース結果を見てみましょう。

```
root[1] (1:1-1:20, 0-19)
└─ paragraph[2] (1:1-1:20, 0-19)
   ├─ text: "とある魔術の" (1:1-1:7, 0-6)
   └─ ruby[1] (1:7-1:20, 6-19) [rubyText="インデックス"][data={"hName":"ruby"}]
      └─ text: "禁書目録" (1:8-1:12, 7-11)
```

正しくパースされているようです！ ルビの内容を `rubyText` に入れることで、このあとHTMLへの変換時に用いることができます。また、`hName` という名前のプロパティはremark-rehypeが読み取りに対応しており、HTML変換時のタグ名を指定することができます。


## Transformerを拡張してみる

次に、解析された構文木を正しくHTMLに変換するためTransformerを改造します。remark-rehypeにはオプションとしてhandlerを追加することができるため、ruby用のhandlerを用意する形で実装します。

```js
const all = require('mdast-util-to-hast/lib/all');
const u = require('unist-builder');

function rubyHandler(h, node) {
  const rtStart = node.children.length > 0
    ? node.children[node.children.length - 1].position.end
    : node.position.start;
  const rtNode = h(
    {
      start: rtStart,
      end: node.position.end,
    },
    'rt',
    [u('text', node.rubyText)]
  );
  return h(node, 'ruby', [...all(h, node), rtNode]);
}
```

`h` はmdastノードからhastノードへ変換する関数となっており、この関数の引数として実際のHTMLタグ名などを指定します。`all` はすべての子ノードに `h` を適用するヘルパー関数で、`u` もまたunistノードを作成するヘルパー関数です。このhandlerでは、`rtNode` という新しいノードを作成し、それをrubyタグのノードの子として挿入していることがわかります。

作成したhandlerは、以下の形式で利用します。オプションとして `handlers` にオブジェクト形式で与えることで、名前の一致するmdastノードはこのhandlerを通してhastノードが生成されるようになります。

```js
const processor = unified()
  .use(markdown)
  .use(rubyAttacher)
  .use(remark2rehype, {
    handlers: { ruby: rubyHandler },
  })
  .use(html);
```

すると、出力されるhastは以下のようになります。

```
root[1] (1:1-1:20, 0-19)
└─ element[2] (1:1-1:20, 0-19) [tagName="p"]
   ├─ text: "とある魔術の" (1:1-1:7, 0-6)
   └─ element[2] (1:7-1:20, 6-19) [tagName="ruby"]
      ├─ text: "禁書目録" (1:8-1:12, 7-11)
      └─ element[1] (1:12-1:20, 11-19) [tagName="rt"]
         └─ text: "インデックス"
```

handler無しでは存在しなかった `rt` タグが追加されました！ これにより、最終的に以下のHTMLが出力されます。

```html
<p>とある魔術の<ruby>禁書目録<rt>インデックス</rt></ruby></p>
```

これでMarkdownで自由にHTMLのルビを挿入できるようになりました！


## まとめ

VivliostyleとRemarkは実際には無関係なライブラリです。しかし、Markdownの変換環境の構築によってVivliostyleが読み込むHTMLを素早く出力できるようになれば、そのまま文書完成までの時間が短縮できる大きなメリットがあります。Markdownは書きやすいだけでなくルールが少ない点も特徴であり、自分で文法を追加する余地が多くあります。ぜひ目的に適した拡張を追加して、快適な執筆環境を作ってみてください。

