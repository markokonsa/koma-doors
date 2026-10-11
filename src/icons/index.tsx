import tallinnCardSrc from "../assets/projects/tallinn-card.jpg";
import ulemisteCitySrc from "../assets/projects/ulemiste-city.png";

/** Logo images for projects, by project id. Projects without one get a two-letter monogram. */
export const PROJECT_LOGOS: Record<string, { src: string; background: string }> = {
  tc: { src: tallinnCardSrc, background: "#fa0000" },
  PR0340: { src: ulemisteCitySrc, background: "transparent" },
};
