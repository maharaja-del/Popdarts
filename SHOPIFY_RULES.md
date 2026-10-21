# Shopify section rules (Popdarts theme)

Every section, block, snippet and template written for this theme must follow these rules. Each one comes from
a save error Shopify has actually thrown on this store, or from Shopify's schema validation. Breaking one means
the file will not save in the code editor (`FileSaveError`) or will not sync from GitHub.

## Before handing anything over

```sh
node tools/shopify-check.js sections/my-section.liquid templates/page.my-page.json   # specific files
node tools/shopify-check.js my-page-export                                            # a whole export folder
node tools/shopify-check.js "C:/Users/abdul/Downloads/my-page"                        # the Downloads copy
```

The checker must report **0 errors** for every file you deliver. That includes the copies in export folders and
in Downloads: check the folder itself after copying, because a stale copy is what gets pasted into Shopify.
The checker needs no install (plain Node). A run with no arguments checks the whole repo. Some theme files we
didn't write (`header.liquid`, `page.swaptop-lp.json`) already fail; leave them alone unless asked.

## 1. Names: 25 characters maximum

`FileSaveError: Invalid schema: name is too long (max 25 characters)`

- The limit covers the section `name`, **every block `name`** and **every preset `name`**.
- The count includes spaces and the campaign prefix. `"Cyber Monday: "` alone uses 14 of the 25.
- If a name is a `t:` translation key, the English text it resolves to is what gets counted.
- Choose the name when you write the schema, count it, and keep it at 25 or under. For example:

| Too long (26)                  | Fixed                          |
| ------------------------------ | ------------------------------ |
| `Cyber Monday: Hero + deals`   | `Cyber Monday: Hero+Deals` (24) |
| `Cyber Monday: How it plays`   | `Cyber Monday: Gameplay` (22)   |

- Use short campaign prefixes, e.g. `Prime Day: ` (11), `Holiday: ` (9), `BFCM: ` (6), `Halloween: ` (11).
  For block names, drop the prefix: `Deal`, `Gift tab`, `Question`.

## 2. No `{` or `}` inside any Liquid tag or output

Not even inside a quoted string. A `}` inside `{{ }}` ends the output early ("Variable was not properly
terminated"). Shopify's editor also rejected `{pct}` inside a `{% %}` string on the Prime Day page.

```liquid
{%- comment -%} Wrong {%- endcomment -%}
{% assign label = 'Save {pct}%' %}

{%- comment -%} Right: a [token] placeholder, swapped with replace {%- endcomment -%}
{% assign label = settings.badge | default: 'Save [pct]%' | replace: '[pct]', pct %}
```

Braces are fine in HTML, CSS, JS and inside the `{% schema %}` JSON, but not inside the Liquid delimiters.
Setting defaults that merchants edit should use `[token]` placeholders too.

## 3. Schema JSON

- Use strict JSON: no comments and no trailing commas. Use only one `{% schema %}` per file.
- `tag` (if set): `article`, `aside`, `div`, `footer`, `header` or `section`.
- `max_blocks` ≤ 50. Block `type`s must be unique within a section. `@app` blocks take no name or settings.
- `enabled_on` or `disabled_on`, never both.
- Presets may only use block types and setting ids that exist in the same schema.

## 4. Settings

| Type | Rule |
| --- | --- |
| every input | unique `id` within its section/block, a `label`, and never `"default": null` (omit the key) |
| `range` | `default` is **required**; `(max - min) / step` ≤ **101**; `default` between min and max **and** on a step; `unit` ≤ 3 characters |
| `select`, `radio` | `default` must be one of the `options[].value`s |
| `checkbox` | `default` is `true`/`false`, not a string |
| `number` | `default` is a number |
| `url` | `default` can only be `/collections` or `/collections/all`. For any other link, leave it blank and use `{{ section.settings.link \| default: '/pages/play' }}` in Liquid |
| `richtext` | `default` must start with `<p>`, `<ul>`, `<ol>` or `<h1>`–`<h6>` |
| `inline_richtext` | no block tags (`<p>`, `<div>`, lists, headings) |
| `color` | hex (`#23ff53`) or `rgb()`/`rgba()` |
| `image_picker`, `video`, `product`, `collection`, `page`, `blog`, `article`, `product_list`, `collection_list` | **no `default`**. Set images in the template JSON or fall back in Liquid (e.g. an asset via `asset_url`) |
| `product_list`, `collection_list` | `limit` ≤ 50 |
| `header`, `paragraph` | need `content` |

## 5. Template JSON (`templates/*.json`)

- **No `null` anywhere.** Leave a key out rather than writing `null`.
- Every key in `order` must exist in `sections`. A section that isn't in `order` won't render.
- Each section's `block_order` must list its blocks exactly. Every block `type` must exist in the section's
  schema (app blocks need an `@app` block in the schema).
- Template values follow the same rules as defaults: ranges on-step, select values from the options,
  richtext wrapped in `<p>`, `product_list` as an array of handles.
- A template holds ≤ 25 sections and ≤ 50 blocks per section (or the section's `max_blocks`).
- When Shopify's editor commits a template back to `main`, it adds a `/* ... */` comment header. Take
  Shopify's copy, strip the header, and re-apply your changes.

## 6. Shipping a page

- New pages go out as a **separate, unpublished template** (`page.<name>.json`) plus `popdarts-<prefix>-*`
  sections, snippets and assets. Don't edit live templates or theme-wide files unless asked.
- Work on a branch. Pushing to `main` deploys to the live theme, so only do it when explicitly told to.
  Shopify's editor commits back to `main`, so fetch/rebase before pushing.
- Hand-off folder: copy the delivered files into `<page>-export/` and into the Downloads folder, with the theme
  layout (`sections/`, `snippets/`, `assets/`, `templates/`) and a `README.txt`. Then run
  `node tools/shopify-check.js` on **both folders** and confirm they are byte-identical to the repo.
- After any fix, update every copy (repo, export folder, Downloads folder) and re-run the checker on each.

## 7. This theme's CSS (not a save error, but it breaks layouts)

`assets/theme.css` styles every `h1`–`h6`, `blockquote` and `button` (fixed height/padding, `display:flex`,
`opacity:.5` when disabled) and hides `div:empty` unless it has `.no-empty`. Scope each page under one root
class (e.g. `.pdcm`) and reset those elements inside it.
