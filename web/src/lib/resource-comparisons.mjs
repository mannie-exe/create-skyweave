import selectedModels from '../../../authoring/resource-selections.json' with { type: 'json' }
export const approvedSelections = selectedModels.selections

import localMedia from '../../data/research/resourcepacks/local-media.json' with { type: 'json' }

const descriptions = {
  barrels: {
    title: 'Barrels',
    question: 'Which barrel geometry fits beside the current blocks?',
    limit:
      'Open-state models are static. These packs do not add a smooth barrel-lid animation.',
  },
  chest: {
    title: 'Chests and Lootr',
    question:
      'Does the new geometry preserve Fresh animations and Lootr materials?',
    limit:
      'The composition covers single ordinary, trapped and Lootr chests. Large and ender chests are unchanged controls.',
  },
  workstations: {
    title: 'Workstations',
    question: 'Do the extra shapes improve crafting and utility blocks?',
    limit:
      'Drawers, tools and stonecutter details are decorative, not new interactions.',
  },
  plants: {
    title: 'Plants',
    question: 'Which models fill gaps beside the installed crops and pots?',
    limit:
      'These archived comparisons predate the selected Toasty pitcher models. Kelp and seagrass retain the existing stack.',
  },
  shelves: {
    title: 'Shelves and hives',
    question:
      'Is the extra depth worth replacing the current connected framing?',
    limit:
      'Preserving the connected bookshelf framing needs further composition work. Classic 3D has no hive replacement.',
  },
  props: {
    title: 'Lights and props',
    question: 'Which small model changes fit beside modded lights?',
    limit:
      'Candidate PBR maps are excluded. The unlit copper bulb is a geometry comparison.',
  },
  doors: {
    title: 'Doors and surfaces',
    question: 'Do the added shapes fit the surrounding materials?',
    limit:
      'These are selective model treatments. Candidate UI, global shaders and broad texture changes are excluded.',
  },
}

export const comparisonRun = 'selective-20261101'
const mediaUrl = (file) => `/generated/resource-review/${file}`
export const comparisons = Object.entries(descriptions).map(
  ([id, description]) => ({
    id,
    run: comparisonRun,
    ...description,
    date: localMedia.runs[comparisonRun].date,
    context: localMedia.runs[comparisonRun].context,
    captures: localMedia.media
      .filter(
        (media) =>
          media.run === comparisonRun &&
          media.gallery !== false &&
          media.file.startsWith(`${comparisonRun}/comparison-${id}-`) &&
          'originals' in media,
      )
      .map((media) => ({
        id: media.id,
        sha256: media.sha256,
        caption: media.caption.replace(
          ' Same crop and scale; unedited originals below.',
          '',
        ),
        sheet: mediaUrl(media.file),
        originals:
          ('originals' in media ? media.originals : undefined)?.map(
            (original) => ({
              id: original.label
                .replace(/^[A-Z] · /, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/-$/, ''),
              sha256: localMedia.media.find(
                (item) => item.file === original.file,
              )?.sha256,
              label: original.label,
              url: mediaUrl(original.file),
            }),
          ) ?? [],
      }))
      // Start with shader-off captures; retain shader-on evidence as separate scenes.
      .sort(
        (a, b) =>
          Number(a.id.endsWith('-shader')) - Number(b.id.endsWith('-shader')),
      ),
    videos: localMedia.media
      .filter(
        (media) =>
          media.run === comparisonRun &&
          media.kind === 'video' &&
          id === 'chest' &&
          media.gallery !== false,
      )
      .map((media) => ({
        caption: media.caption,
        url: mediaUrl(media.file),
        sha256: media.sha256,
      })),
  }),
)
