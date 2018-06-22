'use strict'
/* eslint-disable node/no-unpublished-require */
const test = require('tap').test
const tt = require('../index.js')
// const makeChangedTag = require('../index.js')._makeChangedTag
const createReplacing = require('../index.js')._createReplacing
const qw = require('qw')
const toml = require('qtoml')

const opts = {preferredFandoms: ['PRIMARY'], resortShipTags: true}
const preferredFandoms = new Set(opts.preferredFandoms)

function sameTags (t, got, expected, msg) {
  msg = msg ? msg + ' ' : ''
  t.is(got.length, expected.length, msg + 'length')
  expected.forEach((val, ii) => {
    t.is(String(got[ii]), val, msg + 'value #' + ii + ': ' + val)
  })
}

/*
test('construction', async t => {
  const direct = require('../index.js')
  t.ok(direct.sortTags, 'direct use')

  const withConfig = require('../index.js')({primaryFandoms: ['example']})
  t.ok(withConfig.sortTags, 'with config')

  const TagTools = require('../index.js')
  class Example extends TagTools {}
  t.ok(new Example().sortTags, 'as class')
})
*/

test('tagCompare', async t => {
  // alpha
  t.is(tt.tagCompare('zzz', 'abc'), 1, 'zzz < abc')
  t.is(tt.tagCompare('abc', 'zzz'), -1, 'abc > zzz')
  t.is(tt.tagCompare('abc', 'abc'), 0, 'abc = abc')

  // case insensitive
  t.is(tt.tagCompare('ZZZ', 'abc'), 1, 'ZZZ < abc')
  t.is(tt.tagCompare('abc', 'ZZZ'), -1, 'abc > ZZZ')
  t.is(tt.tagCompare('ABC', 'ABC'), 0, 'ABC = ABC')

  // non-alphanum insensitive
  t.is(tt.tagCompare('abc.def', 'abc!def'), 0, 'abc.def = abc!def')

  // fandom and status before plain, plus untyped before typed
  for (let cat of qw`fandom fusion xover`) {
    t.is(tt.tagCompare('aaa', `${cat}:aaa`), 1, `aaa < ${cat}:aaa`)
    t.is(tt.tagCompare(`${cat}:aaa`, 'aaa'), -1, `${cat}:aaa > aaa`)
  }
  // untyped last
  t.is(tt.tagCompare('aaa', `bbb:zzz`), 1, `aaa < bbb:zzz`)
  t.is(tt.tagCompare(`bbb:zzz`, 'aaa'), -1, `bbb:zzz > aaa`)
  // status last
  t.is(tt.tagCompare('aaa', `status:aaa`), -1, `aaa > status:aaa`)
  t.is(tt.tagCompare(`status:aaa`, 'aaa'), 1, `status:aaa < aaa`)

  // fandom before fusion
  t.is(tt.tagCompare('fusion:aaa', 'fandom:zzz'), 1, 'fusion:aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'fusion:aaa'), -1, 'fandom:zzz > fusion:aaa')

  // fandom before xover
  t.is(tt.tagCompare('xover:aaa', 'fandom:zzz'), 1, 'xover:aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'xover:aaa'), -1, 'fandom:zzz > xover:aaa')

  // fandom before status
  t.is(tt.tagCompare('status:aaa', 'fandom:zzz'), 1, 'status:aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'status:aaa'), -1, 'fandom:zzz > status:aaa')

  // fandom before typed
  t.is(tt.tagCompare('example:aaa', 'fandom:zzz'), 1, 'example:aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'example:aaa'), -1, 'fandom:zzz > example:aaa')

  // fandom before typed
  t.is(tt.tagCompare('example:aaa', 'fandom:zzz'), 1, 'example:aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'example:aaa'), -1, 'fandom:zzz > example:aaa')

  // fandom before untyped
  t.is(tt.tagCompare('aaa', 'fandom:zzz'), 1, 'aaa < fandom:zzz')
  t.is(tt.tagCompare('fandom:zzz', 'aaa'), -1, 'fandom:zzz > aaa')

  // fusion before xover
  t.is(tt.tagCompare('xover:aaa', 'fusion:zzz'), 1, 'xover:aaa < fusion:zzz')
  t.is(tt.tagCompare('fusion:zzz', 'xover:aaa'), -1, 'fusion:zzz > xover:aaa')

  // fusion before status
  t.is(tt.tagCompare('status:aaa', 'fusion:zzz'), 1, 'status:aaa < fusion:zzz')
  t.is(tt.tagCompare('fusion:zzz', 'status:aaa'), -1, 'fusion:zzz > status:aaa')

  // fusion before typed
  t.is(tt.tagCompare('example:aaa', 'fusion:zzz'), 1, 'example:aaa < fusion:zzz')
  t.is(tt.tagCompare('fusion:zzz', 'example:aaa'), -1, 'fusion:zzz > example:aaa')

  // fusion before typed
  t.is(tt.tagCompare('example:aaa', 'fusion:zzz'), 1, 'example:aaa < fusion:zzz')
  t.is(tt.tagCompare('fusion:zzz', 'example:aaa'), -1, 'fusion:zzz > example:aaa')

  // fusion before untyped
  t.is(tt.tagCompare('aaa', 'fusion:zzz'), 1, 'aaa < fusion:zzz')
  t.is(tt.tagCompare('fusion:zzz', 'aaa'), -1, 'fusion:zzz > aaa')

  // primary fandom first
  t.is(tt.tagCompare('fandom:aaa', 'fandom:PRIMARY', preferredFandoms), 1, 'fandom:aaa < fandom:PRIMARY')
  t.is(tt.tagCompare('fandom:PRIMARY', 'fandom:aaa', preferredFandoms), -1, 'fandom:PRIMARY > fandom:aaa')
})

test('sortTags', async t => {
  const unsorted = [
    'zzz',
    'xover:aaa',
    'fusion:zzz',
    'fandom:aaa',
    'aaa     zzz',
    'aaa aaa',
    'status:complete',
    'example:aaa',
    'fandom:PRIMARY'
  ]
  const expected = [
    'fandom:PRIMARY',
    'fandom:aaa',
    'fusion:zzz',
    'xover:aaa',
    'example:aaa',
    'aaa aaa',
    'aaa     zzz',
    'zzz',
    'status:complete'
  ]
  t.isDeeply(tt.sortTags(unsorted, preferredFandoms), expected, 'sort ok')
})

test('fandoms', async t => {
  const raw = [
    'ggg',
    'fandom:abc',
    'hhh',
    'xover:def|ghi',
    'iii',
    'fusion:zzz',
    'kkk'
  ]
  const expected = [ 'abc', 'def', 'ghi', 'zzz' ]
  t.isDeeply(tt.fandoms(raw), expected, 'fandoms')
})

test('fandom', async t => {
  t.is(tt.fandom(['abc'], preferredFandoms), undefined, 'no fandom')
  t.is(tt.fandom(['fandom:abc'], preferredFandoms), 'abc', 'one fandom')
  t.is(tt.fandom(['fandom:xyz', 'fandom:abc'], preferredFandoms), 'xyz', 'multiple fandom')
  t.is(tt.fandom(['fandom:xyz', 'fandom:PRIMARY'], preferredFandoms), 'PRIMARY', 'primary fandom')
  t.is(tt.fandom(['fandom:xyz', 'xover:PRIMARY'], preferredFandoms), 'PRIMARY', 'primary fandom even when xover')
  t.is(tt.fandom(['fandom:xyz', 'xover:PRIMARY|abc'], preferredFandoms), 'PRIMARY|abc', 'primary fandom even when sub')
  t.is(tt.fandom(['fandom:xyz', 'fusion:PRIMARY'], preferredFandoms), 'PRIMARY', 'primary fandom even when fusion')
  t.is(tt.fandom(['fandom:xyz', 'fusion:PRIMARY|abc'], preferredFandoms), 'PRIMARY|abc', 'primary fandom even when sub')
})

test('uniqTags', async t => {
  t.isDeeply(tt.uniqTags(['fandom:abc', 'fandom:abc']), ['fandom:abc'], 'exact dups')
  t.isDeeply(tt.uniqTags(['fandom:abc', 'xover:abc']), ['fandom:abc'], 'xover exact dups')
  t.isDeeply(tt.uniqTags(['fandom:abc', 'fusion:abc']), ['fandom:abc'], 'fusion exact dups')
  t.isDeeply(tt.uniqTags(['fandom:def', 'fandom:abc|def']), ['fandom:abc|def'], 'long dups')
  let list = [
    'fandom:aa',
    'fandom:bb',
    'fandom:aa|bb',
    'fandom:zz|bb',
    'fandom:cc',
    'fandom:cc',
    'fandom:dd|ee',
    'fandom:ee'
  ]

  t.isDeeply(tt.uniqTags(list), ['fandom:aa', 'fandom:aa|bb', 'fandom:zz|bb', 'fandom:cc', 'fandom:dd|ee'])
})

test('createMapping', async t => {
  const raw = tt.createMapping({
    example: {
      abc: [ 'def' ],
      '/zzz/': [ 'ZZZ' ]
    }
  })
  const expected = {
    sitemap: {
      example: {
        map: { abc: [ {replace: [ createReplacing('def') ]} ] },
        replacers: [ {search: /zzz/g, replace: [ 'ZZZ' ]} ]
      }
    }
  }
  t.like(raw, expected)
})

test('mapTagsFor', async t => {
  const sitemap = tt.createMapping({
    example: {
      abc: 'def',
      ghi: [ 'aaa', 'bbb' ],
      '/zzz/': 'ZZZ',
      '/^cc(\\w+).+/': [ '!$1!', '$&' ]
    }
  }, opts)
  const tags = sitemap.withTags([
    'abc',
    'ghi',
    'thizzz izzz a test',
    'ccYUP hmm'
  ])
  const expected = [
    'def',
    'aaa',
    'bbb',
    'thiZZZ iZZZ a test',
    '!YUP!',
    'ccYUP hmm'
  ]
  sameTags(t, sitemap._translateTagsFor('example', tags), expected)
})

test('fandompipe', async t => {
  const result = tt.createMapping({}).translateTags('example', ['fandom:aa|bb'])
  const expected = [ 'fandom:aa', 'fandom:aa|bb' ]
  const unchanged = [ 'fandom:aa|bb' ]
  const changed = [ 'fandom:aa' ]
  t.isDeeply(result.values(), expected, 'values')
  sameTags(t, result.unchanged(), unchanged, 'unchanged')
  sameTags(t, result.changed(), changed, 'changed')
})

test('mapTags recordMutation', async t => {
  const map = tt.createMapping({
    'example': {
      'character:Test': 'character:Fullname',
      'character:abc': 'shipname:abc',
      'character:zed (yyy)': 'character:zed',
      'freeform:xxx & freeform:yyy': 'freeform:xxx yyy'
    }
  }, opts)
  const tags = [
    'xover:PRIMARY',
    'character:zed (yyy) (mentioned)',
    'character:test',
    'character:abc',
    'character:test (mentioned)',
    'ship:test (ilu)/def (in passing)',
    'ship:Test/Test (right now)',
    'freeform:xxx',
    'freeform:alone',
    'ship:plain/test',
    'freeform:yyy'
  ]
  const unchanged = [
    'freeform:alone'
  ]
  const changed = [
    'fandom:PRIMARY',
    'character:Fullname',
    'character:Fullname - mentioned',
    'character:zed - mentioned',
    'freeform:xxx yyy',
    'ship:def/Fullname - ilu (in passing)',
    'ship:Fullname/Fullname (right now)',
    'ship:Fullname/plain',
    'shipname:abc'
  ]
  const expected = [
    'fandom:PRIMARY',
    'character:Fullname',
    'character:Fullname - mentioned',
    'character:zed - mentioned',
    'freeform:xxx yyy',
    'freeform:alone',
    'ship:def/Fullname - ilu (in passing)',
    'ship:Fullname/Fullname (right now)',
    'ship:Fullname/plain',
    'shipname:abc'
  ]
  const result = map.translateTags('example', tags)
  t.isDeeply(result.values(), expected, 'values')
  sameTags(t, result.unchanged(), unchanged, 'unchanged')
  sameTags(t, result.changed(), changed, 'changed')
})

test('mapTags', async t => {
  const map = tt.createMapping({
    'example': {
      'character:Test': 'character:Fullname',
      'character:abc': 'shipname:abc',
      'character:zed (yyy)': 'character:zed',
      'freeform:xxx & freeform:yyy': 'freeform:xxx yyy',
      'ship:nm': 'ship:mmm/nnn',
      'fandom:uuu': 'fandom:UUU'
    }
  }, opts)
  const tags = [
    'xover:PRIMARY',
    'xover:uuu',
    'Fusion',
    'character:zed (yyy) (mentioned)',
    'character:test',
    'character:abc',
    'shipname:abc',
    'character:test (mentioned)',
    'ship:test (ilu)/def (in passing)',
    'ship:Test/Test (right now)',
    'freeform:xxx',
    'freeform:alone',
    'ship:plain/test',
    'canon:AU',
    'canon:AU:abc',
    'character:zow!test',
    'freeform:yyy',
    'ship:nm (implied)'
  ]
  const expected = [
    'fandom:PRIMARY',
    'fusion:UUU',
    'canon:AU',
    'canon:AU:abc',
    'character:Fullname',
    'character:Fullname - mentioned',
    'character:zed - mentioned',
    'character:zow!Fullname',
    'freeform:xxx yyy',
    'freeform:alone',
    'ship:def/Fullname - ilu (in passing)',
    'ship:Fullname/Fullname (right now)',
    'ship:Fullname/plain',
    'ship:mmm/nnn (implied)',
    'shipname:abc',
    'Fusion'
  ]
  sameTags(t, map.translateTags('example', tags), expected)
})

test('resortShips', async t => {
  const map = tt.createMapping({
    'example': {}
  }, opts)
  const tags = map.withTags([
    'friendship:aaa & bbb',
    'friendship:bbb/ccc',
    'ship:OC/You',
    'ship:aaa/OC',
    'ship:You/bbb'
  ])
  const expected = [
    'friendship:aaa & bbb',
    'friendship:bbb & ccc',
    'ship:aaa/OC',
    'ship:bbb/You',
    'ship:OC/You'
  ]
  sameTags(t, tags.translate('example'), expected)
})

test('splitShips', async t => {
  const map = tt.createMapping({
    'example': {}
  }, opts)
  const tags = map.withTags([
    'ship:aaa & bbb',
    'ship:aaa/ccc',
    'ship:aaa and ddd',
    'ship:aaa x eee',
    'ship:aaa X fff',
    'friendship:aaa & bbb',
    'friendship:aaa/ccc',
    'friendship:aaa and ddd',
    'friendship:aaa x eee',
    'friendship:aaa X fff',
    'ship:aaa',
    'ship:ccc (zzz) & ddd (xxx)',
    'ship:aaa/bbb and ccc'
  ])
  const expected = [
    'friendship:aaa & bbb',
    'friendship:aaa & ccc',
    'friendship:aaa & ddd',
    'friendship:aaa & eee',
    'friendship:aaa & fff',
    'ship:aaa',
    'ship:aaa/bbb',
    'ship:aaa/bbb and ccc',
    'ship:aaa/ccc',
    'ship:aaa/ddd',
    'ship:aaa/eee',
    'ship:aaa/fff',
    'ship:ccc - zzz/ddd (xxx)'
  ]
  sameTags(t, tags.translate('example'), expected)
})
test('bug', async t => {
  const map = tt.createMapping(toml`
    ["*"]
    "character:Ben Solo | Kylo Ren" = "character:Kylo Ren"
    "character:Original Character(s)" = [ "OC" ]
  `, opts)
  const tags = map.withTags([
    'ship:Rey/Ben Solo | Kylo Ren',
    'friendship:Lucius Malfoy & Original Character(s)'
  ])
  const expected = [
    'friendship:Lucius Malfoy & OC',
    'ship:Kylo Ren/Rey'
  ]
  sameTags(t, tags.translate('example'), expected)
})
