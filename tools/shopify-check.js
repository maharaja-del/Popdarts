#!/usr/bin/env node
// Pre-upload check for Shopify theme files. Catches the errors Shopify's code editor / GitHub sync
// rejects on save (FileSaveError) before anyone pastes a file in. No dependencies: `node tools/shopify-check.js <files...>`
//   sections/*.liquid, blocks/*.liquid  -> schema rules + Liquid tokenizer rules
//   snippets/*.liquid, layout/*.liquid  -> Liquid tokenizer rules
//   templates/*.json                    -> template rules (checked against the section schemas)
// With no arguments it checks every section, block, snippet and template in the repo.
// Exit code 1 if any ERROR is found. Rules are documented in SHOPIFY_RULES.md.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Limits Shopify has rejected files for ("FileSaveError: Invalid schema: ... is too long (max N characters)")
const NAME_MAX = 25; // section, block and preset name
const OPTION_LABEL_MAX = 50; // select/radio option label
// Shopify doesn't publish limits for these fields. Each number is the longest value Shopify has accepted on this
// store (measured across the 216 live sections on main, Oct 2026). Anything longer is untested, so it's an error.
const PROVEN_MAX = {
  label: 58, info: 208, header: 46, paragraph: 211, id: 32, optionValue: 22, blockType: 20, placeholder: 18,
  textDefault: 285, richtextDefault: 182,
};
const RANGE_MAX_STEPS = 101;
const RESOURCE_TYPES = ['image_picker', 'video', 'product', 'collection', 'blog', 'page', 'article', 'product_list', 'collection_list', 'metaobject', 'metaobject_list', 'font_picker_none'];
const URL_DEFAULTS = ['/collections', '/collections/all'];
const SECTION_TAGS = ['article', 'aside', 'div', 'footer', 'header', 'section'];

let errors = 0;
let warnings = 0;
const rel = (f) => { const r = path.relative(ROOT, f); return (r.startsWith('..') ? f : r).split(path.sep).join('/'); };
const err = (f, msg) => { errors++; console.log(`ERROR  ${rel(f)}: ${msg}`); };
const warn = (f, msg) => { warnings++; console.log(`warn   ${rel(f)}: ${msg}`); };

// "t:sections.foo.name" -> text from locales/en.default.schema.json (Shopify measures the resolved text)
let schemaLocale = {};
try { schemaLocale = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales/en.default.schema.json'), 'utf8')); } catch (e) { /* no locale file */ }
const resolve = (s) => {
  if (typeof s !== 'string' || !s.startsWith('t:')) return s;
  const v = s.slice(2).split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), schemaLocale);
  return typeof v === 'string' ? v : s;
};

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// Shopify's tokenizer: /{%.*?%}|{{.*?}}?/m. A "}" inside {{ }} ends the output early, and the editor rejects any
// "{" or "}" inside a {% tag %} - even inside a quoted string.
function checkLiquid(file, src) {
  const body = src.replace(/\{%-?\s*schema\s*-?%\}[\s\S]*?\{%-?\s*endschema\s*-?%\}/, (m) => m.replace(/[^\n]/g, ' '));
  const re = /\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}?/g;
  let m;
  while ((m = re.exec(body))) {
    const t = m[0];
    let problem = null;
    if (t.startsWith('{{')) {
      if (!t.endsWith('}}')) problem = 'a "}" inside {{ }} ends the output early';
      else if (/[{}]/.test(t.slice(2, -2))) problem = 'brace inside {{ }}';
    } else if (/[{}]/.test(t.slice(2, -2).replace(/^-/, '').replace(/-$/, ''))) {
      problem = 'brace inside {% %} (use a [token] placeholder + replace)';
    }
    if (problem) err(file, `line ${lineOf(body, m.index)}: ${problem}: ${t.replace(/\s+/g, ' ').slice(0, 90)}`);
  }
  const schemas = src.match(/\{%-?\s*schema\s*-?%\}/g) || [];
  if (schemas.length > 1) err(file, 'more than one {% schema %} tag');
}

const stripTrailingCommas = (json) => json.replace(/,(\s*[\]}])/g, '$1');

function readSchema(file, src) {
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) {
    // Shopify tolerates trailing commas in a schema; anything else is a save error
    try { const lax = JSON.parse(stripTrailingCommas(m[1])); warn(file, 'schema has trailing commas (Shopify tolerates them; strict JSON is safer)'); return lax; } catch (e2) { /* really broken */ }
    err(file, `schema is not valid JSON: ${e.message}`);
    return null;
  }
}

function checkName(file, where, name, required) {
  if (name === undefined) { if (required) err(file, `${where} has no name`); return; }
  const text = resolve(name);
  if (typeof text !== 'string' || !text.trim()) { err(file, `${where} name is empty`); return; }
  if (text.length > NAME_MAX) err(file, `${where} name is ${text.length} characters (max ${NAME_MAX}): "${text}"`);
}

// proven = true for the PROVEN_MAX fields, where the number is a safe ceiling rather than Shopify's stated maximum
function checkLength(file, at, what, value, max, proven) {
  const text = resolve(value);
  if (typeof text !== 'string' || text.length <= max) return;
  const limit = proven ? `longest Shopify has accepted here is ${max}` : `max ${max}`;
  err(file, `${at}: ${what} is ${text.length} characters (${limit}): "${text.slice(0, 70)}"`);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const onStep = (v, min, step) => Math.abs(((v - min) / step) - Math.round((v - min) / step)) < 1e-9;

// Checks one setting definition. Returns nothing; reports problems.
function checkSettingDef(file, where, s) {
  const at = `${where} setting "${s.id || s.type}"`;
  if (!s.type) { err(file, `${where}: a setting has no type`); return; }
  if (s.type === 'header' || s.type === 'paragraph') {
    if (!s.content) err(file, `${at}: ${s.type} needs "content"`);
    checkLength(file, at, `${s.type} content`, s.content, PROVEN_MAX[s.type], true);
    return;
  }
  if (!s.id) err(file, `${where}: ${s.type} setting has no id`);
  if (!s.label && s.type !== 'liquid') warn(file, `${at}: no label`);
  checkLength(file, at, 'id', s.id, PROVEN_MAX.id, true);
  checkLength(file, at, 'label', s.label, PROVEN_MAX.label, true);
  checkLength(file, at, 'info', s.info, PROVEN_MAX.info, true);
  checkLength(file, at, 'placeholder', s.placeholder, PROVEN_MAX.placeholder, true);
  if (['text', 'textarea'].includes(s.type)) checkLength(file, at, 'default', s.default, PROVEN_MAX.textDefault, true);
  if (['richtext', 'inline_richtext'].includes(s.type)) checkLength(file, at, 'default', s.default, PROVEN_MAX.richtextDefault, true);
  const d = s.default;
  const has = Object.prototype.hasOwnProperty.call(s, 'default');
  if (has && d === null) err(file, `${at}: default is null (omit it instead)`);
  switch (s.type) {
    case 'range': {
      const { min, max, step = 1 } = s;
      if (![min, max, step].every(isNum)) { err(file, `${at}: range needs numeric min, max, step`); break; }
      if (min >= max) err(file, `${at}: min must be below max`);
      if (step <= 0) { err(file, `${at}: step must be positive`); break; }
      const steps = (max - min) / step;
      if (steps > RANGE_MAX_STEPS) err(file, `${at}: ${steps} steps (max ${RANGE_MAX_STEPS}) - raise step or narrow min/max`);
      if (!onStep(max, min, step)) err(file, `${at}: (max - min) is not a multiple of step`);
      if (!has) err(file, `${at}: range needs a default`);
      else if (!isNum(d) || d < min || d > max || !onStep(d, min, step)) err(file, `${at}: default ${d} is not a valid step between ${min} and ${max}`);
      if (s.unit && String(s.unit).length > 3) err(file, `${at}: unit "${s.unit}" is longer than 3 characters`);
      break;
    }
    case 'number':
      if (has && !isNum(d)) err(file, `${at}: number default must be a number`);
      break;
    case 'checkbox':
      if (has && typeof d !== 'boolean') err(file, `${at}: checkbox default must be true/false`);
      break;
    case 'select':
    case 'radio': {
      const opts = Array.isArray(s.options) ? s.options : [];
      if (!opts.length) err(file, `${at}: ${s.type} needs options`);
      opts.forEach((o) => {
        if (o.value === undefined || o.label === undefined) err(file, `${at}: every option needs value and label`);
        checkLength(file, at, 'option label', o.label, OPTION_LABEL_MAX, false);
        checkLength(file, at, 'option value', o.value, PROVEN_MAX.optionValue, true);
      });
      if (has && !opts.some((o) => o.value === d)) err(file, `${at}: default "${d}" is not one of the option values`);
      break;
    }
    case 'url':
      if (has && !URL_DEFAULTS.includes(d)) err(file, `${at}: url default can only be ${URL_DEFAULTS.join(' or ')} (got "${d}") - use | default: in Liquid instead`);
      break;
    case 'richtext':
      if (has && typeof d === 'string' && d.trim() && !/^\s*<(p|ul|ol|h[1-6])[\s>]/.test(d)) err(file, `${at}: richtext default must start with <p>, <ul>, <ol> or <h1>-<h6>`);
      break;
    case 'inline_richtext':
      if (has && /<(p|ul|ol|div|h[1-6])[\s>]/.test(String(d))) err(file, `${at}: inline_richtext default cannot contain block tags`);
      break;
    case 'color':
      if (has && typeof d === 'string' && d && !/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(d) && !/^rgba?\(/i.test(d)) err(file, `${at}: color default must be a hex or rgb() value`);
      break;
    case 'product_list':
    case 'collection_list':
      if (s.limit !== undefined && (!isNum(s.limit) || s.limit > 50)) err(file, `${at}: limit must be 50 or less`);
      break;
    default:
  }
  if (RESOURCE_TYPES.includes(s.type) && has) err(file, `${at}: ${s.type} settings cannot have a default`);
  if (['text', 'textarea', 'html', 'liquid'].includes(s.type) && has && d === '') warn(file, `${at}: empty-string default (omit it instead)`);
}

function checkSettingsList(file, where, settings) {
  if (settings === undefined) return;
  if (!Array.isArray(settings)) { err(file, `${where}: settings must be an array`); return; }
  const seen = new Set();
  settings.forEach((s) => {
    if (s.id) { if (seen.has(s.id)) err(file, `${where}: duplicate setting id "${s.id}"`); seen.add(s.id); }
    checkSettingDef(file, where, s);
  });
}

function checkSectionSchema(file, schema, isThemeBlock) {
  const kind = isThemeBlock ? 'block file' : 'section';
  checkName(file, kind, schema.name, !isThemeBlock);
  if (schema.tag && !SECTION_TAGS.includes(schema.tag)) err(file, `tag "${schema.tag}" must be one of ${SECTION_TAGS.join(', ')}`);
  if (schema.enabled_on && schema.disabled_on) err(file, 'use enabled_on or disabled_on, not both');
  if (schema.max_blocks !== undefined && (!isNum(schema.max_blocks) || schema.max_blocks > 50)) err(file, 'max_blocks must be 50 or less');
  checkSettingsList(file, kind, schema.settings);
  const types = new Set();
  (schema.blocks || []).forEach((b, i) => {
    const where = `block "${b.type || i}"`;
    if (!b.type) { err(file, `block ${i} has no type`); return; }
    if (types.has(b.type)) err(file, `duplicate block type "${b.type}"`);
    types.add(b.type);
    if (b.type.startsWith('@')) return; // @app / @theme take no name or settings
    checkLength(file, where, 'block type', b.type, PROVEN_MAX.blockType, true);
    if (!isThemeBlock || b.name !== undefined) checkName(file, where, b.name, !isThemeBlock);
    checkSettingsList(file, where, b.settings);
  });
  (schema.presets || []).forEach((p, i) => {
    checkName(file, `preset ${i + 1}`, p.name, true);
    const blocks = Array.isArray(p.blocks) ? p.blocks : Object.values(p.blocks || {});
    blocks.forEach((b) => {
      if (!isThemeBlock && b.type && !b.type.startsWith('@') && !types.has(b.type)) err(file, `preset "${resolve(p.name)}" uses unknown block type "${b.type}"`);
    });
  });
  const ids = new Set((schema.settings || []).map((s) => s.id));
  (schema.presets || []).forEach((p) => Object.keys(p.settings || {}).forEach((k) => {
    if (!ids.has(k)) err(file, `preset "${resolve(p.name)}" sets unknown setting "${k}"`);
  }));
}

// A template is checked against the section next to it (export folder) first, then the repo's copy.
function sectionSchemaFor(type, templateFile) {
  const f = [path.join(path.dirname(path.dirname(templateFile)), 'sections', `${type}.liquid`), path.join(ROOT, 'sections', `${type}.liquid`)].find((p) => fs.existsSync(p));
  if (!f) return undefined;
  const m = fs.readFileSync(f, 'utf8').match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { try { return JSON.parse(stripTrailingCommas(m[1])); } catch (e2) { return null; } }
}

// Value stored in a template against its setting definition.
function checkSettingValue(file, where, def, v) {
  if (v === null) return; // reported by findNulls
  if (!def) { warn(file, `${where}: setting is not in the section schema (Shopify drops it)`); return; }
  if (typeof v === 'string' && v.includes('{{')) return; // dynamic source
  switch (def.type) {
    case 'range': {
      const { min, max, step = 1 } = def;
      if (!isNum(v) || v < min || v > max || !onStep(v, min, step)) err(file, `${where}: ${v} is not a valid step between ${min} and ${max}`);
      break;
    }
    case 'number': if (!isNum(v)) err(file, `${where}: must be a number`); break;
    case 'checkbox': if (typeof v !== 'boolean') err(file, `${where}: must be true/false`); break;
    case 'select':
    case 'radio': if (!(def.options || []).some((o) => o.value === v)) err(file, `${where}: "${v}" is not one of the option values`); break;
    case 'richtext': if (typeof v === 'string' && v.trim() && !/^\s*<(p|ul|ol|h[1-6])[\s>]/.test(v)) err(file, `${where}: richtext must start with <p>, <ul>, <ol> or <h1>-<h6>`); break;
    case 'product_list':
    case 'collection_list': if (!Array.isArray(v)) err(file, `${where}: must be an array of handles`); else if (def.limit && v.length > def.limit) err(file, `${where}: ${v.length} items (limit ${def.limit})`); break;
    default:
  }
}

function findNulls(file, node, trail) {
  if (node === null) { err(file, `null value at ${trail} (remove the key)`); return; }
  if (Array.isArray(node)) node.forEach((x, i) => findNulls(file, x, `${trail}[${i}]`));
  else if (typeof node === 'object') Object.entries(node).forEach(([k, x]) => findNulls(file, x, `${trail}.${k}`));
}

function checkTemplate(file, src) {
  const json = src.replace(/^﻿?\s*\/\*[\s\S]*?\*\//, '');
  let t;
  try { t = JSON.parse(json); } catch (e) { err(file, `not valid JSON: ${e.message}`); return; }
  findNulls(file, t, '$');
  const sections = t.sections || {};
  const keys = Object.keys(sections);
  if (keys.length > 25) err(file, `${keys.length} sections (max 25 per template)`);
  if (Array.isArray(t.order)) {
    t.order.forEach((k) => { if (!sections[k]) err(file, `order lists "${k}" but there is no such section`); });
    keys.forEach((k) => { if (!t.order.includes(k)) warn(file, `section "${k}" is not in order (it will not render)`); });
  } else if (!t.layout && !Object.prototype.hasOwnProperty.call(t, 'order')) err(file, 'missing "order" array');
  keys.forEach((k) => {
    const s = sections[k];
    if (!s || !s.type) { err(file, `section "${k}" has no type`); return; }
    if (s.type.startsWith('_') || s.type === 'apps' || s.type.startsWith('shopify://')) return;
    const schema = sectionSchemaFor(s.type, file);
    if (schema === undefined) { err(file, `section "${k}": sections/${s.type}.liquid does not exist`); return; }
    if (schema === null) return; // reported when the section itself is checked
    const defs = Object.fromEntries((schema.settings || []).filter((d) => d.id).map((d) => [d.id, d]));
    Object.entries(s.settings || {}).forEach(([id, v]) => checkSettingValue(file, `${k}.settings.${id}`, defs[id], v));
    const blocks = s.blocks || {};
    const bkeys = Object.keys(blocks);
    const max = schema.max_blocks || 50;
    if (bkeys.length > max) err(file, `section "${k}": ${bkeys.length} blocks (max_blocks ${max})`);
    const order = s.block_order || [];
    order.forEach((b) => { if (!blocks[b]) err(file, `section "${k}": block_order lists "${b}" but there is no such block`); });
    bkeys.forEach((b) => { if (!order.includes(b)) warn(file, `section "${k}": block "${b}" is missing from block_order (it will not render)`); });
    const btypes = Object.fromEntries((schema.blocks || []).map((b) => [b.type, b]));
    bkeys.forEach((b) => {
      const blk = blocks[b];
      if (blk.type && blk.type.startsWith('shopify://apps/')) { if (!btypes['@app']) err(file, `section "${k}": app block "${b}" but the schema has no @app block`); return; }
      const bdef = btypes[blk.type];
      if (!bdef) { err(file, `section "${k}": block "${b}" has type "${blk.type}" which the schema does not define`); return; }
      const bdefs = Object.fromEntries((bdef.settings || []).filter((d) => d.id).map((d) => [d.id, d]));
      Object.entries(blk.settings || {}).forEach(([id, v]) => checkSettingValue(file, `${k}.blocks.${b}.settings.${id}`, bdefs[id], v));
    });
  });
}

// The theme folder a file sits in (sections, blocks, templates...), so export folders are checked the same way.
const folderOf = (file) => path.basename(path.dirname(file));

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const folder = folderOf(file);
  if (file.endsWith('.json') && folder === 'templates') { checkTemplate(file, src); return; }
  if (!file.endsWith('.liquid')) return;
  checkLiquid(file, src);
  if (folder === 'sections' || folder === 'blocks') {
    const schema = readSchema(file, src);
    if (schema) checkSectionSchema(file, schema, folder === 'blocks');
    else if (folder === 'sections' && schema === null && !/\{%-?\s*schema/.test(src)) warn(file, 'no {% schema %}');
  }
}

// Arguments can be files or folders (an export folder is walked recursively).
const walk = (p) => (fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).flatMap((f) => (f === 'node_modules' || f.startsWith('.') ? [] : walk(path.join(p, f))))
  : [p]);
let files = process.argv.slice(2).flatMap((f) => walk(path.resolve(f)));
if (!process.argv[2]) files = ['sections', 'blocks', 'snippets', 'templates'].filter((d) => fs.existsSync(path.join(ROOT, d))).flatMap((d) => walk(path.join(ROOT, d)));
files = files.filter((f) => /\.(liquid|json)$/.test(f) && !(f.endsWith('.json') && folderOf(f) !== 'templates'));
files.forEach(checkFile);
console.log(`\n${files.length} files checked: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
