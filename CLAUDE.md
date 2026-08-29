@AGENTS.md

# STOP — VoxelPop lock for ChatGPT / Codex

The owner asked agents to stop making VoxelPop worse.

Do **not**:
- add property-address / one-of-one identity gates before photo creation
- point 3D viewers at SVG demo art (`demo-house.svg` is illustration only)
- sample images with `naturalWidth || 1` (that blanks the 3D)
- restyle away from cream / purple / lime VoxelPop
- add finance, wallet, map, or command-center chrome to Home/Create
- rewrite the four-stage creator (PHOTO → REVIEW → BUILD → DONE)
- charge anything other than $4.99 for one digital creation
- claim a voxel is a deed, title, or investment

Do:
- keep 3D working on the homepage (`LocalVoxelModelViewer` + `/voxelpop/demo-house.jpg`)
- keep `/demo` as a free no-login 3D sample
- make the smallest possible diff
- run `npm run test:simple-property-world` and `npm run test:public-demo`

If the user says they liked it a few minutes ago, revert the latest drive-by refactor instead of adding another one.
