# @fanfic/tag-tools

Tag management functions for fanfic

## SYNOPSIS

```js
const tt = require('@fanfic/tag-tools')

// these can accept a config as a final argument, exactly as createMapping
// does below
const tags = tt.sortTags([…])
const tags = […].sort((aa, bb) => tt.tagCompare(aa, bb)) // slower, mutates

console.log(tt.fandoms(tags))

console.log(tt.uniqTags(tags))

const mapping = tt.createMapping({}, {
  preferredFandoms: [ 'fandom1', 'fandom2', 'fandom3' ],
  resortShipTags: true
})

// these differ in that they get the config from the mapping
const tags = mapping.sortTags([…])
const tags = […].sort((aa, bb) => mapping.tagCompare(aa, bb)) // slower, mutates

console.log(mapping.fandoms(tags))

// a bit more involved with a mapping from disk…

const fs = require('fs')
const TOML = require('@iarna/toml')

async function example () {
  const tagmappings = await TOML.parse.stream(fs.createReadStream('tagmap.toml'))
  const mapping = tt.createMapping(tagmappings)

  // make a tags object and act on it
  const tags = mapping.withTags(rawtgs)

  // tag object methods mutates
  // remap tags using only global rules (mutates)
  console.log(tags.translate())
  // remap tags for a specific block of remappings
  console.log(tags.translate('section-name'))
  // show only the tags that weren't translated
  console.log(tags.unchanged())
  // show only the tags that were translated
  console.log(tags.changed())
  // get all the tags back as plain strings
  console.log(tags.values())
  // sort and uniq
  console.log(tags.sort())
  console.log(tags.uniq())
  // fandom and fandoms extraction
  console.log(tags.fandom())
  console.log(tags.fandoms())

  // or skip the tags object, does not mutate

  // remap tags using only global rules
  console.log(mapping.translate(rawtags))
  // remap tags for a specific block of remappings
  console.log(mapping.translate('section-name', rawtags))
  // show only the tags that weren't translated
  console.log(mapping.translate('section-name', rawtags).unchanged())
  // show only the tags that were translated
  console.log(mapping.translate('section-name', rawtags).changed())
  // get all the tags back as plain strings
  console.log(mapping.translate('section-name', rawtags).values())

}
```

## DESCRIPTION

## CONSTRUCTION

### const tt = require('@fanfic/tag-tools')

Get the collection of stand alone functions:

* fandom(tags,[ preferredFandoms]) → String - The first preferred fandom in the tag list, or the first if no preferred fandom is found.
* fandoms(tags) → Array - All fandoms in tags
* sortTags(tags[, preferredFandoms]) → Array - A copy of all tags, sorted, preferred fandoms sort before others.
* tagCompare(tagA, tagB[, preferredFandoms]) → Integer - Compare two tags, suitable for use with `sort()`
* createMapping(mapdata[, options]) → TagMapping - see next…

## const mapping = tt.createMapping(mapping[, options]) → TagMap object

The options object is optional.  If specified they override any
configuration found in the mapping file. Valid options are:

* preferredFandoms - An Array or Set of fandom names (with no `fandom:`
  prefix) that you want given priority.  If one of these fandoms shows up in
  a list of tags then `fandom()` will identify it as the fandom in
  preference to others.  Preferred fandoms will also be sorted ahead of
  other fandoms. This defaults to an empty set.
* unprefixedCharMatchers - Array - When remapping the character names inside of ship tags, the resulting
  mapping may include both a character name and other metadata. We need to be able to dientify the
  character name part. We count anything starting with `character:`. This is an Array of strings
  and regexps that are matched against each tag resulting from transforming a character name. The
  default value is `[ 'OC', 'OFC', 'OMC' ]`.
* resortShipTags - If true, ship tags will be reordered to be alphabetical. 
  Defaults to false.  (In some fandoms and for some fans, the order of ship
  tags is important information.)
* charsToSortToLast - An array of character names and regexps that should be sorted to the
  end of the ship list. This only applies when resortShipTags is true. Defaults to:
    `[ 'OFC', 'OMC', 'OC', 'Reader', 'You', 'Harem', 'Other(s)', '?', '*', '/ - OC$| [(]OC[)]$/' ]`
* makeCharCommentsShipSafe - Defaults to false unless `resortShipTags` is
  enabled, in which case it defaults to true.  Characters can have comments
  after them, eg `character:Alice (OC)` and ships can have comments after
  them `ship:Alice/Joan (established)` and the character names in ships can
  ALSO have comments we end up with an ambiguity problem.  This amibiguity
  problem matters when resorting ship tags, because comments associated with
  a character should be resuffled with the char, but ones associated with
  the ship should NOT.  This tries to help with that by remapping any
  instances of `character:Charname (comment)` to 
  `character:Charname - comment` and dynamically adding that mapping to the
  tagmap, so that when the charnames in the ship tag are translated they'll
  have the same thing done.  So if you had `character:Alice (OC)` and
  `ship:Joan/Alice (OC)` then you would end up with`character:Alice - OC`
  and `ship:Alice - OC/Joan`.  But if you had
  `ship:Joan/Alice (established)` then you'd get 
  `ship:Alice/Joan (established)`.  Basically this does the right thing and
  you probably want to leave it alone.

The returned mapping object has the following methods:

* uniqTags(tags) → Array - A copy of the tags, uniqueed 
* translateTags([sectionName,] tags) → Array (TagList) - A copy of the tags translated per the mapping
* withTags(tags) → Arrary (TagList) - A copy of the tags with no changes, but see next…

## const tags = mapping.withTags(fic.tags) -> TagList object

TagList objects are a type of Array.  They're always tied to a TagMap, so
they pick up mappings and options from there, when needed.  They're extended
with the following properties:

* fandom() → String
* fandoms() → Array
* translate() - Runs the translation against this tag list, mutating it and returning itself for chaining
* sort([comparator]) - With a comparator, exactly like Array.sort, without sorts using sortTags. As with Array.sort this mutates the list.
* uniq() - Removes any duplicate entries from the list and returns it. This mutates the list.
* changed() - Returns an array of tags that were changed by `translate()`.
* unchanged() - Returns an array of tags that have not been changed by `translate()`.
* values() - Returns a plain array of tags.

## TAG FORMATS

Tags are any valid unicode string.  Common practice is to pair a tag type
with a tag value.  This is done by entering the type in lower case without
spaces, followed by a colon, followed by the value.  Types directly
supported by this library are:

* `fandom:` - the material is related to the specified fandom
* `fusion:` - the fandom is fused with another fandom (as specified with `fandom:`)
* `xover:` - the fandom is xover with another fandom (as specified with `fandom:`)
* `character:` - a character playing an important role in the fic
* `ship:` - Indicates two characters are in a romantic or sexual relationship, names are separated with a `/`. A comment regarding the relationship can be added to the end in parenthesis.
* `friendship:` - Indicates two characters have a close friendship, names are separated with ` & `. A comment regarding the relationship can be added to the end in parenthesis.

Other common types are:

* `status:` - With values of, for example: `in-progress`, `complete`, `one-shot` and `abandoned`
* `genre:` - A genre of this work
* `cn:` - A content note for this work (content notes are a superset of trigger warnings and content warnings)

## TAG MAPPING FILE FORMAT

I use TOML files to store my tag maps, and load them as shown in the
example.  Examples explaining the file format are in TOML, but you could use
JSON or YAML any other format that supports some basic structures.

### CONFIGURATION

The tagmap can carry the same configuration as the options passed in, just
using kebab case instead of camel case.  This should go in a section named
`--CONFIG--`. The defaults look like this:

```toml
[--CONFIG--]
preferred-fandoms = [ ]
unprefixed-char-matchers = [ 'OC', 'OFC', 'OMC' ]
chars-to-sort-to-last = [
  'OFC', 'OMC', 'OC', 'Reader', 'You', 'Harem', 'Other(s)', '?', '*',
  '/ - OC$| [(]OC[)]$/'
]
resort-ship-tags = false
#make-char-comments-ship-safe = true # by default this follows the value of resort-ship-tags
```

The remainder of the configuration is made up of sections with pairs of
transformations.  A section is the string you pass in to `transform(…)` and
selects which mappings will be used.  I use separate sections for each site
I process tags for, since tag conventions vary a lot between sites, so
you'll see something like this in my mappings:

```toml
[ao3]
```

The left hand side of the transformation pairs can be literals:

```toml
'character:Alice' = 'character:Alice Fullname'
```

Or they can be regular expressions (contained in quotes).  They'll only
replace the part of the tag that matched.

```toml
'/Original Character/' = 'OC'
```

The right hand side can be a single value as above, or a list of values:

```toml
'freeform:Action & Comedy' = [ 'genre:Action', 'genre:Comedy' ]
```

If the left hand side is a regexp, then the right hand side can include
match variables.  For example, the following:

```toml
'/^(?:character:|(?:friend)?ship:.*)(O[FM]?C)$/' = [ "$&", "$1" ]
```
Would map `[ 'character:Alice - OC' ]` to `[ 'character:Alice - OC', 'OC' ]`.

Regular expressions are all run, in the order found in the tagmap,
before any direct matching is done.

As mentioned previously, the section to get transforms from is passed into
`transform()`.  However, some others will also be tried.  Transforms from
the following sections (if they exist) will be run in order:

* `pre:*`
* `pre:${section}`
* `${section}`
* `post:${section}`
* `*`

Then for each fandom found in the tag list (with a preferred fandom first, if any was found):

All `pre:${fandom}` sections are run.  Followed by all `${fandom}` sections,
followed by all `post:${fandom}`.

Then the `post:*` section is run.

After all this, ship tags have their character portions translated
(this might be after the ship tag itself was translated in the previous
step).  This remapping happens in this late phase, but runs through each of
the previous phases in the order described.

And finally, if enabled, the ship tags are resorted.

Then the whole list of now translated tags is case insensitively uniqued and
sorted and the result returned.

### OTHER TAG HANDLING BEHAVIORS

The tag translator endevors to only have one `fandom:` value in the tagset. 
The rest will be flagged either `xover:` or `fusion:`.

`fandom:` tags can be compound, from most specific to least, for example:
`fandom:Spider-Man: Into the Spider-Verse|Spider-Man|Marvel`.  This would
remove any stand alone `fandom:Spider-Man` or `fandom:Marvel` tags as
duplicates.  If this was the primary fandom for the fic, then in this case
two `fandom:` tags would be emitted, one without the compound, eg
`fandom:Spider-Man: Into the Spider-Verse` and one with it.

Remapping of character namesWhen remapping character names found in ship tags
