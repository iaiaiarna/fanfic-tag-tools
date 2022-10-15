'use strict'
exports.fandom = fandom
exports.fandoms = fandoms
exports.sortTags = sortTags
exports.tagCompare = tagCompare
exports.uniqTags = uniqTags
exports.createMapping = createMapping
exports._createReplacing = createReplacing

const util = require('util')
const qr = require('@perl/qr')

const defaultConfig = {
  'preferred-fandoms': [],
  'unprefixed-char-matchers': [ 'OC', 'OFC', 'OMC' ],
  'resort-ship-tags': false,
  'chars-to-sort-to-last': [
    'OFC', 'OMC', 'OC', 'Reader', 'You', 'Harem', 'Other(s)', '?', '*',
    '/ - OC$| [(]OC[)]$/'
  ]
}

function fandom (tags, preferredFandoms) {
  if (preferredFandoms) {
    for (let primary of preferredFandoms) {
      const [primaryMatch] = tags.filter(_ => qr`^(fandom|xover|fusion):(?:.*[|]\s*)?${primary}(\s*[|]|$)`.test(_))
      if (primaryMatch) return primaryMatch.slice(primaryMatch.indexOf(':') + 1)
    }
  }
  let fandoms = tags.filter(_ => _.startsWith('fandom:'))[0]
  if (fandoms) return fandoms.slice(7)
  let fusions = tags.filter(_ => _.startsWith('fusion:'))[0]
  if (fusions) return fusions.slice(7)
  let xovers = tags.filter(_ => _.startsWith('xover:'))[0]
  if (xovers) return xovers.slice(6)
}
function fandoms (tags) {
  return uniqAnyCase(flatMap(tags.filter(_ => /^(fandom|xover|fusion):/.test(_)), fandomsFromTag))
}

function sortTags (tags, preferredFandoms) {
  const sortable = {}
  tags.forEach((_, ii) => sortable[_] = {ii, _: sortableFandom(_, preferredFandoms)})
  return tags.sort((aa, bb) => sortable[aa]._.localeCompare(sortable[bb]._) || sortable[aa].ii - sortable[bb].ii)
}

function tagCompare (aa, bb, preferredFandoms) {
  return sortableFandom(aa, preferredFandoms).localeCompare(sortableFandom(bb, preferredFandoms))
}

function uniqTags (tags) {
  const newTags = []
  const seenTags = {}
  const seenFandoms = {}
  let firstFandom
  tags.forEach(tag => {
    const ltag = tag.toLowerCase()
    if (seenTags[ltag]) return
    seenTags[ltag] = tag
    if (/^(fandom|fusion|xover):/.test(ltag)) {
      const fandom = ltag.slice(ltag.indexOf(':') + 1)
      if (!firstFandom) firstFandom = fandom
      if (fandom in seenFandoms) return
      // look for existing tags that we're a prefix of, and skip if we find one
      for (let existing of Object.keys(seenFandoms)) {
        if (existing !== firstFandom && qr`^${existing}[|]`.test(fandom)) {
          seenFandoms[fandom] = tag
          return
        }
      }
      // look for fandoms our subbits are prefixes of and delete them
      for (let chunk of fandomsFromTag(ltag).slice(1)) {
        for (let existing of Object.keys(seenFandoms)) {
          if (seenFandoms[existing] && qr`^${chunk}([|]|$)`.test(existing)) {
            newTags.splice(newTags.indexOf(seenFandoms[existing]), 1)
            delete seenFandoms[existing]
          }
        }
        seenFandoms[chunk] = false
      }
      seenFandoms[fandom] = tag
    }
    newTags.push(tag)
  })
  return newTags
}

// ---

function createMapping (rawmap, opts) {
  return new TagMapping(rawmap, opts)
}

const _opts = Symbol('opts')
class TagMapping {
  constructor (rawmap, opts) {
    this.sitemap = {}
    const conf = Object.assign({}, defaultConfig)
    for (let site of Object.keys(rawmap)) {
      if (site.toLowerCase() === '--config--') {
        for (let _ of Object.keys(rawmap[site])) {
          conf[_] = rawmap[site][_]
        }
        continue
      }
      const map = {}
      const replacers = []
      this.sitemap[site] = {map, replacers}
      for (let _ of Object.keys(rawmap[site])) {
        const regexpReplace = makeArray(rawmap[site][_])
        const replace = regexpReplace.map(createReplacing)
        const _lc = _.toLowerCase()
        if (/^[/].*[/]$/.test(_)) {
          replacers.push({search: qr.g`${[_.slice(1, -1)]}`, replace: regexpReplace})
        } else if (/^\w+:.*\s+&\s+\w+:/.test(_)) {
          const [first, ...rest] = _lc.split(/\s+&\s+/)
          if (map[first]) {
            map[first].unshift({has: rest, replace})
          } else {
            map[first] = [{has: rest, replace}]
          }
          for (let rm of rest) {
            const others = rest.filter(_ => _ !== rm).concat(first)
            if (map[rm]) {
              map[rm].unshift({has: others, replace})
            } else {
              map[rm] = [{has: others, replace}]
            }
          }
        } else if (map[_lc]) {
          map[_lc].push({replace})
        } else {
          map[_lc] = [{replace}]
        }
      }
    }
    if (!opts) opts = {}
    if (opts.preferredFandoms) conf['preferred-fandoms'] = opts.preferredFandoms
    if (opts.charsToSortToLast) conf['chars-to-sort-to-last'] = opts.charsToSortToLast
    if (opts.resortShipTags) {
      conf['resort-ship-tags'] = opts.resortShipTags
      if (opts['make-char-comments-ship-safe'] == null) opts['make-char-comments-ship-safe'] = true
    }
    if (opts.makeCharCommentsShipSafe) conf['make-char-comments-ship-safe'] = opts.makeCharCommentsShipSafe
    if (opts.unprefixedCharMatchers) conf['unprefixed-char-matchers'] = opts.unprefixedCharMatchers
    this[_opts] = {}
    if (conf['preferred-fandoms']) {
      this[_opts].preferredFandoms = Array.isArray(conf['preferred-fandoms']) ? new Set(conf['preferred-fandoms']) : conf['preferred-fandoms']
    } else {
      this[_opts].preferredFandoms = new Set()
    }
    if (conf['chars-to-sort-to-last']) {
      this[_opts].charsToSortLast = conf['chars-to-sort-to-last'].map(char => {
        if (/^[/].*[/]$/.test(char)) {
          return qr`${[char.slice(1, -1)]}`
        } else {
          return char
        }
      })
    } else {
      this[_opts].charsToSortToLast = []
    }
    if (conf['unprefixed-char-matchers']) {
      this[_opts].unprefixedCharMatchers = conf['unprefixed-char-matchers'].map(char => {
        if (/^[/].*[/]$/.test(char)) {
          return qr`${[char.slice(1, -1)]}`
        } else {
          return char
        }
      })
    } else {
      this[_opts].unprefixedCharMatchers = []
    }
    this[_opts].resortShipTags = Boolean(conf['resort-ship-tags'])
    if (conf['make-char-comments-ship-safe']) {
      this[_opts].makeCharCommentsShipSafe = conf['make-char-comments-ship-safe']
    } else {
      this[_opts].makeCharCommentsShipSafe = this[_opts].resortShipTags
    }
  }
  withTags (tags) {
    return createTagList(tags, this, this[_opts])
  }
  uniqTags (tags) {
    return uniqTags(tags)
  }
  fandom (tags) {
    return fandom(tags, this[_opts].preferredFandoms)
  }

  _matchMapping (tag, mapping, tags) {
    const match = mapping[tag]
    if (!match) return
    for (let mm of match) {
      if (!mm.has) return mm.replace
      if (tags && mm.has.every(_ => tags.some(t => t.toLowerCase() === _))) {
        mm.has.forEach(_ => tags.splice(tags.indexOf(_), 1))
        return mm.replace
      }
    }
  }

  _remapTag (tag, mapping, tags) {
    const ltag = tag.toLowerCase()
    const [, kind, fandom] = ltag.match(/^(fandom|xover|fusion):(.*)/) || []
    if (kind) {
      let replaceWith = this._matchMapping(`fandom:${fandom}`, mapping, tags)
      if (replaceWith) return replaceWith.map(_ => tagReplace(_, /^fandom:/, `${kind}:`))
    }
    // let chars be remapped even if they include!attributes or if they have
    // (comments) or - comments.
    const [, bpath, char, pcmnt, dcmnt] = tag.match(qr`^character:((?:[^!]+!)*)([^!]+?)(?: ?[(]([^)]{2,})[)]| - (.*))?$`) || []
    if (this[_opts].makeCharCommentsShipSafe && char) {
      const cmnt = pcmnt || dcmnt
      const replaceWith = this._matchMapping(`character:${char.toLowerCase()}`, mapping, tags)
      const pre = bpath || ''
      const post = cmnt ? ` - ${cmnt}` : ''
      if (replaceWith) return replaceWith.map(_ => tagReplace(_, /^(character:)(.*)/, `$1${pre}$2${post}`))
      const full = this._matchMapping(ltag, mapping, tags)
      if (full) return full
      return [createReplacing('character:' + pre + char + post)]
    }
    // can't properly do ships here, as ships can be cross fandom and we
    // only can look at one fandom here.

    return this._matchMapping(ltag, mapping, tags) || makeArray(tag)
  }

  _translateTagsFor (section, tags) {
    const tagmap = this.sitemap[section]
    if (!tagmap) return tags
    let newTags = this.withTags([])
    for (let ii = 0; ii < tags.length; ++ii) {
      let tag = tags[ii]
      for (let sr of tagmap.replacers) {
        if (!sr.search.test(tag)) continue
        const search = sr.search
        tag = flatMap(sr.replace, replace => flatMap(tag, _ => tagReplace(_, search, replace)))
      }
      const mapTo = flatMap(tag, _ => this._remapTag(_, tagmap.map, tags))
      newTags.push(...mapTo)
    }
    return newTags
  }
  translateTags (section, tags) {
    if (!tags) {
      tags = section
      section = null
    }
    return this.withTags(tags).translate(section)
  }
  _translateTags (section, tags) {
    tags.mutate(_ => _.trim())
    tags = this._translateTagsFor('pre:*', tags)
    if (section != null) tags = this._translateTagsFor(`pre:${section}`, tags)
    if (section != null) tags = this._translateTagsFor(section, tags)
    if (section != null) tags = this._translateTagsFor(`post:${section}`, tags)
    tags = this._translateTagsFor('*', tags)

    // Get a list of fandoms, but put a primary fandom first if possible
    const fandomList = uniqAnyCase([tags.fandom()].concat(tags.fandoms()).filter(_ => _))

    for (let fandom of fandomList) {
      tags = this._translateTagsFor(`pre:${fandom}`, tags)
    }
    for (let fandom of fandomList) {
      tags = this._translateTagsFor(fandom, tags)
    }
    for (let fandom of fandomList) {
      tags = this._translateTagsFor(`post:${fandom}`, tags)
    }

    tags = this._translateTagsFor('post:*', tags)

    tags.uniq()

    const isFusion = tags.some(_ => _ === 'Fusion' || _.startsWith('fusion:'))
    const xwith = isFusion ? 'fusion:' : 'xover:'

    // if this is a fusion, then mark things as fusions not xovers. Striction speaking you _could_
    // have xovers into a fused story, but that's the area of dirty dirty multcrosses, and we're
    // not gonna worry about that. =p
    if (isFusion) tags.mutate(_ => _.replace(/^xover:/, 'fusion:'))

    // Look for more than one `fandom:` tag when it's not a clarification tag, and change it
    // to fusion: or xover: as appropriate
    const taggedFandoms = tags.filter(_ => _.startsWith('fandom:'))
    let primaryFandom = fandom(taggedFandoms)
    if (primaryFandom && taggedFandoms.length > 1) {
      const primary = `fandom:${primaryFandom}`
      // Only do remapping if the detected fandom is tagged a `fandom:`
      if (tags.some(tag => tag.startsWith(primary))) {
        tags.mutate(_ => _.startsWith(primary) ? _ : _.replace(/^fandom:/, xwith))
      }
    }

    // if nothing is tagged a fandom, see if we can promote something
    if (!primaryFandom) {
      primaryFandom = null
      const xov = tags.filter(_ => _.startsWith(xwith))[0]
      if (xov) {
        const fandom = xov.replace(qr`^${xwith}`, 'fandom:')
        tags.mutate(_ => _ === xov ? fandom : _)
        primaryFandom = fandom
      }
    }
    // Deduplicate here, because we may inject a second, unpiped, fandom tag after
    tags.uniq()

    // If there _is_ a fandom specified, try splitting it on | and ensuring
    // the unpiped version is in the first slot.
    if (primaryFandom) {
      const primaries = fandomsFromTag(primaryFandom)
      const [ shortPrimary ] = primaries
      if (shortPrimary) {
        const tagsToMatch = primaries.length > 1 ? /fandom|xover|fusion/ : /xover|fusion/
        primaries.forEach(fandom => {
          const sameAsPrimary = qr`^${tagsToMatch}:${fandom}(?:$|\s*[|])`
          tags.comb(_ => !sameAsPrimary.test(_))
        })
        tags.unshift(createReplacing(`fandom:${shortPrimary}`))
//        if (shortPrimary !== primaryFandom) {tags.unshift(`fandom:${primaryFandom}`)
      }
    }
    const sections = [
      'pre:*',
      section != null && `pre:${section}`,
      section != null && section,
      section != null && `post:${section}`,
      '*',
      ...fandomList.map(_ => `pre:${_}`),
      ...fandomList.map(_ => _),
      ...fandomList.map(_ => `post:${_}`),
      `post:*`
    ].filter(_ => _)

    // remap the ship tags,
    tags.flatMutate(_ => this._remapShipTag(_, sections, tags))
    // resort the ship tags, they should be in alpha order
    if (this[_opts].resortShipTags) {
      tags.flatMutate(_ => this._resortShipTag(_, sections))
    }
    return tags
  }
  _remapPerson (person, mapping, tags) {
    return this._remapTag(`character:${person}`, mapping, tags)
      .filter(_ => {
        if (_.startsWith('character:')) return true
        for (let match of this[_opts].unprefixedCharMatchers) {
          /* eslint-disable eqeqeq */
          if (_ == match) return true
          if (match instanceof RegExp && match.test(_)) return true
        }
        return false
      })
      .map(_ => _.replace(/^character:/, ''))
  }
  _remapPeople (person, sections, tags) {
    let people = [person]
    for (let section of sections) {
      if (!this.sitemap[section]) continue
      people = uniqAnyCase(flatMap(people, person => this._remapPerson(person, this.sitemap[section].map, tags)))
    }
    return people
  }
  _remapShipTag (startTag, sections, tags) {
    if (!/^(?:friend)?ship:/.test(startTag)) return startTag
    sections = sections.filter(_ => this.sitemap[_])
    let tag = startTag
    const commentMatch = /( [(][^()]+[)]|[(][^()]{3,}[)])$/
    const dashCommentMatch = / - (.*?)$/
    let [, comment] = tag.match(commentMatch) || []
    if (comment) {
      tag = tag.replace(commentMatch, '')
    } else if (!/[&/]/.test(tag) && dashCommentMatch.test(tag)) {
      [, comment] = tag.match(dashCommentMatch)
      tag = tag.replace(dashCommentMatch, '')
      comment = ` (${comment})`
    }
    let ship = [tag]
    for (let section of sections) {
      ship = uniqAnyCase(flatMap(ship, _ => this._remapTag(_, this.sitemap[section].map, tags)))
    }
    return ship.map(tag => {
      if (!/^(?:friend)?ship:/.test(tag)) return createReplacing(tag)
      if (tag.startsWith('ship:')) {
        tag = 'ship:' + flatMap(this._splitPeople(tag.slice(5)), _ => this._remapPeople(_, sections, tags)).join('/')
      } else if (tag.startsWith('friendship:')) {
        tag = 'friendship:' + flatMap(this._splitPeople(tag.slice(11)), _ => this._remapPeople(_, sections, tags)).join(' & ')
      }
      tag += comment || ''
      return String(tag) === String(startTag) ? startTag : createReplacing(tag)
    })
  }

  _splitPeople (ship) {
    const result = []
    let current = null
    let splitWith
    if (/&/.test(ship)) splitWith = /&/
    else if (/[/]/.test(ship)) splitWith = /[/]/
    else if (/ and /.test(ship)) splitWith = / and /
    else if (/ [Xx] /.test(ship)) splitWith = / [Xx] /
    ship.split(splitWith).forEach(chunk => {
      if (chunk == null) return
      if (!current && (chunk === '&' || chunk === '/' || chunk === ' and ' || chunk === ' x ' || chunk === ' X ')) {
        return
      }
      current = current ? current + chunk : chunk
      const open = current.match(/[(]/g)
      const openC = open ? open.length : 0
      const closed = current.match(/[)]/g)
      const closedC = closed ? closed.length : 0
      if (openC === closedC) {
        result.push(current)
        current = null
      }
    })
    if (current) result.push(current)
    return result.map(_ => _.trim())
  }

  _resortShipTag (startTag, sections) {
    let prefix
    let length
    let joinWith
    if (startTag.startsWith('ship:')) {
      prefix = 'ship:'
      length = 5
      joinWith = '/'
    } else if (startTag.startsWith('friendship:')) {
      prefix = 'friendship:'
      length = 11
      joinWith = ' & '
    } else {
      return startTag
    }

    const commentMatch = /( [(][^()]+[)]|[(][^()]{3,}[)])$/
    const [, comment] = startTag.match(commentMatch) || []
    let tag = comment ? startTag.replace(commentMatch, '') : startTag

    let ship = tag.slice(length)
    tag = prefix + this._splitPeople(ship).sort((aa, bb) => this._shipCompare(aa, bb)).join(joinWith)
    tag = tag + (comment || '')
    return String(tag) === String(startTag) ? startTag : createReplacing(tag)
  }

  _shipCompare (aa, bb) {
    const shipSortToEnd = aa => {
      for (let char of this[_opts].charsToSortLast) {
        if (aa === char) return true
        if (aa instanceof RegExp && char.test(aa)) return true
      }
      return false
    }

    if (aa === bb) return 0
    if (shipSortToEnd(aa) && shipSortToEnd(bb)) return aa.localeCompare(bb)
    if (shipSortToEnd(aa)) return 1
    if (shipSortToEnd(bb)) return -1
    return aa.localeCompare(bb)
  }
}

const _tagmap = Symbol('tagmap')
function createTagList (tags, tagmap, opts) {
  const tl = new TagList(tags.length)
  tags.forEach((_, ii) => tl[ii] = _)
  tl[_tagmap] = tagmap
  tl[_opts] = opts
  return tl
}
class TagList extends Array {
  fandom () {
    return fandom(this, this[_opts].preferredFandoms)
  }
  fandoms () {
    return fandoms(this)
  }
  translate (section) {
    this.splice(0, this.length, ...this[_tagmap]._translateTags(section, this))
    return this.sort().uniq().map(createChanged)
  }
  comb (fn) {
    return createTagList(this.filter(fn), this[_tagmap], this[_opts])
  }
  sort (compare) {
    if (compare) {
      super.sort(compare)
    } else {
      sortTags(this, this[_opts].preferredFandoms)
    }
    return this
  }
  uniq () {
    this.splice(0, this.length, ...uniqTags(this))
    return this
  }
  changed () {
    return this.filter(wasChanged).map(String)
  }
  unchanged () {
    return this.filter(_ => !wasChanged(_)).map(String)
  }
  values () {
    return Array.apply(null, this.map(String))
  }
  mutate (fn) {
    this.forEach((_, ii) => this[ii] = fn(_))
    return this
  }
  flatMutate (fn) {
    const tagCount = this.length
    for (let ii = tagCount - 1; ii >= 0; --ii) {
      const result = fn(this[ii])
      if (Array.isArray(result)) {
        this.splice(ii, 1, ...result)
      } else {
        this.splice(ii, 1, result)
      }
    }
    return this
  }
  toJSON () {
    return this.values()
  }
}

// ---

class ReplacingTag {
  constructor (value) {
    this.value = value
  }
  toLowerCase () { return this.value.toLowerCase() }
  toString () { return this.value }
  toJSON () { return this.value }
  startsWith (search, pos) {
    return this.value.startsWith(search)
  }
  includes (search) {
    return this.value.includes(search)
  }
  match (search) {
    return this.value.match(search)
  }
  replace (search, replace) {
    return createReplacing(this.value.replace(search, replace))
  }
  indexOf (search) {
    return this.value.indexOf(search)
  }
  localeCompare (str) {
    return this.value.localeCompare(str)
  }
  trim () {
    return createReplacing(this.value.trim())
  }
  split (search) {
    return this.value.split(search)
  }
  // note that this returns a string, not a tag
  slice (num) {
    return this.value.slice(num)
  }
}

// This exist to support determining which tags were swapped out and which
// weren't during tag mangling. This is the value-type returned in that case,
// a simple subclass of String.
const $inspect = Symbol.for('nodejs.util.inspect.custom')
class ChangedTag extends String {
  [$inspect] () {
    return '[ChangedTag: ' + util.inspect(String(this)) + ']'
  }
  toJSON () {
    return String(this)
  }
}

function createChanged (value) {
  if (typeof value === 'string') return value
  return new ChangedTag(value)
}
function wasChanged (value) {
  return value instanceof ChangedTag
}

function createReplacing (value) {
  if (value == null) return value
  if (!(value instanceof ReplacingTag) && typeof value !== 'string') throw new Error('Tag not a string, ' + typeof value + ' ' + JSON.stringify(value))
  return new ReplacingTag(String(value))
}

function tagReplace (value, search, replace) {
  const doesMatch = value.match(search)
  if (doesMatch) {
    const result = value.replace(search, replace)
    return result instanceof ReplacingTag ? result : createReplacing(result)
  } else {
    return value
  }
}

// ---

function sortableFandom (tag, preferredFandoms) {
  let cat = ''
  cat += tag.startsWith('fandom:') && preferredFandoms && preferredFandoms.has(tag.slice(tag.indexOf(':') + 1)) ? '0' : '1'
  cat += tag.startsWith('fandom:') ? '0' : '1'
  cat += tag.startsWith('fusion:') ? '0' : '1'
  cat += tag.startsWith('xover:') ? '0' : '1'
  cat += tag.startsWith('status:') ? '1' : '0'
  cat += tag.includes(':') ? '0' : '1'
  return cat + tag.toLowerCase()
    .replace(/^freeform:.*/, 'freeform') // don't sort freeform tags
    .replace(/[^:a-z0-9]+/g, ' ') // remove non-alpha-numeric
    .replace(/\s+/g, ' ') // compress and normalize whitespace
    .trim()
}

function fandomsFromTag (tag) {
  return tag.replace(/^(fandom|xover|fusion):/, '').split('|').map(_ => _.trim())
}

// ---

function uniqAnyCase (arr) {
  const seen = new Set()
  return arr.map(_ => [_, _.toLowerCase()]).filter(_ => {
    if (seen.has(_[1])) return false
    seen.add(_[1])
    return true
  }).map(_ => _[0])
}

function flatMap (arr, fn) {
  /* eslint-disable no-sequences */
  return makeArray(arr).map(fn).reduce((acc, val) => (Array.isArray(val) ? acc.push.apply(acc, val) : acc.push(val), acc), [])
}

function makeArray (arr) {
  if (arr == null) return
  if (Array.isArray(arr)) return arr
  return [arr]
}
