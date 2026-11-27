# Paintings used by the painting themes

All five works are in the public domain (each artist died more than 100 years ago, or the work was
published before 1929). Photographs of two-dimensional public-domain works are also in the public domain
in the United States (Bridgeman v. Corel, 1999).

| File | Work | Copy taken from |
|---|---|---|
| `starry-night.jpg` | Vincent van Gogh, *The Starry Night*, 1889 (crop) | jcjohnson/neural-style, `examples/inputs/starry_night.jpg` |
| `the-scream.jpg` | Edvard Munch, *The Scream*, 1893 | jcjohnson/neural-style, `examples/inputs/the_scream.jpg` |
| `great-wave.jpg` | Katsushika Hokusai, *The Great Wave off Kanagawa*, c. 1831 | lengstrom/fast-style-transfer, `examples/style/wave.jpg` |
| `water-lilies-1906.jpg` | Claude Monet, *Water Lilies*, 1906 | WikiArt (256 px), via the ArtEmis dataset on GitHub |
| `tree-of-life.jpg` | Gustav Klimt, *The Tree of Life* (Stoclet Frieze), 1905-11 | WikiArt (256 px), via the ArtEmis dataset on GitHub |

`tools/paintings.py` crops each one to a wide band, reduces it to 240 x 46 pixels and 24 colours, and dithers
out its sides and lower edge, so that it reads as pixel art across the top of the note and fades into the page.
