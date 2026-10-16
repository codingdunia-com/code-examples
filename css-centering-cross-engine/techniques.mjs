// One entry per centering technique. `container` and `child` are plain CSS text
// applied to a 400x300 scroll container and the box we are trying to center.
// Every container is overflow:auto, so the same rule set can be asked three
// questions: does it center a small box, what does it do to a box that is too
// big, and what can a user still scroll to afterwards.
export const TECHNIQUES = [
  {
    id: 'flex-center',
    label: 'flex + align/justify center',
    container: 'display:flex;justify-content:center;align-items:center',
    child: 'flex:none',
  },
  {
    id: 'flex-safe-center',
    label: 'flex + safe center',
    container: 'display:flex;justify-content:safe center;align-items:safe center',
    child: 'flex:none',
  },
  {
    id: 'flex-margin-auto',
    label: 'flex + margin:auto on child',
    container: 'display:flex',
    child: 'flex:none;margin:auto',
  },
  {
    id: 'grid-place-items',
    label: 'grid + place-items:center (auto track)',
    container: 'display:grid;place-items:center',
    child: '',
  },
  {
    id: 'grid-place-items-fixed',
    label: 'grid + place-items:center (100% track)',
    container: 'display:grid;grid-template:100% / 100%;place-items:center',
    child: '',
  },
  {
    id: 'grid-safe-fixed',
    label: 'grid + place-items:safe center (100% track)',
    container: 'display:grid;grid-template:100% / 100%;place-items:safe center',
    child: '',
  },
  {
    id: 'grid-place-content',
    label: 'grid + place-content:center',
    container: 'display:grid;place-content:center',
    child: '',
  },
  {
    id: 'grid-margin-auto',
    label: 'grid + margin:auto on child',
    container: 'display:grid',
    child: 'margin:auto',
  },
  {
    id: 'abs-transform',
    label: 'absolute + top/left 50% + translate(-50%,-50%)',
    container: 'position:relative',
    child: 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)',
  },
  {
    id: 'abs-inset-margin',
    label: 'absolute + inset:0 + margin:auto',
    container: 'position:relative',
    child: 'position:absolute;inset:0;margin:auto',
  },
  {
    id: 'abs-align-self',
    label: 'absolute + inset:0 + align-self/justify-self:center',
    container: 'position:relative',
    child: 'position:absolute;inset:0;align-self:center;justify-self:center',
  },
  {
    id: 'text-align-line-height',
    label: 'text-align:center + line-height + inline-block',
    container: 'text-align:center;line-height:300px',
    child: 'display:inline-block;vertical-align:middle',
  },
];

// Child sizes in a 400x300 container.
export const SCENARIOS = [
  { id: 'small', label: 'small 200x100', w: 200, h: 100 },
  { id: 'both', label: 'too big both ways 600x500', w: 600, h: 500 },
  { id: 'wide', label: 'too wide only 600x100', w: 600, h: 100 },
  { id: 'tall', label: 'too tall only 200x500', w: 200, h: 500 },
];

export const BOX = { w: 400, h: 300 };
