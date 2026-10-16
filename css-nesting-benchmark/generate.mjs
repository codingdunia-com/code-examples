// A synthetic component stylesheet in the syntax that is valid both as native CSS
// nesting and as SCSS, so one source text can be fed to every pipeline.
//
// Each component block flattens to 7 style rules (the component, its title, the title's
// :hover, .featured, :focus-visible, plus the component and its title again inside one
// @media query), i.e. 8 blocks counting the @media wrapper.
export const generateSource = (n) => {
  const blocks = [];
  for (let i = 0; i < n; i++) {
    const hue = (i * 37) % 360;
    blocks.push(`.c${i} {
  padding: ${4 + (i % 12)}px;
  color: hsl(${hue} 60% 30%);
  border-radius: ${i % 8}px;

  & .title {
    font-size: 1.${i % 9}rem;
    font-weight: 600;

    &:hover {
      text-decoration: underline;
    }
  }

  &.featured {
    border: 2px solid hsl(${hue} 70% 45%);
  }

  &:focus-visible {
    outline: 2px solid hsl(${hue} 80% 40%);
  }

  @media (min-width: 40rem) {
    padding: ${8 + (i % 12)}px;

    & .title {
      font-size: 1.${(i + 3) % 9}rem;
    }
  }
}
`);
  }
  return blocks.join('\n');
};

// Style rules per component after flattening, and "{" blocks including the @media wrapper.
export const RULES_PER_COMPONENT = 7;
export const BLOCKS_PER_COMPONENT = 8;
