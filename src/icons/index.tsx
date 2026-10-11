import type { ComponentType } from "react";
import tallinnCardSrc from "../assets/projects/tallinn-card.jpg";
import ulemisteCitySrc from "../assets/projects/ulemiste-city.png";

/** Anything the UI can render as a project/card icon: Lucide icons and the image icons below all fit. */
export type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

/**
 * Square icon that shows the whole image, uncropped. Images that aren't square are letterboxed, and
 * `background` (match the image's edge colour) fills the gaps so the tile still looks fully covered.
 */
function imageIcon(src: string, alt: string, background = "transparent", radius = "18%"): IconComponent {
  // Drop-in for Lucide icons: `size`/`strokeWidth` are ignored because the image fills the icon tile.
  return function ImageIcon({ className }) {
    return (
      <span
        className={className}
        style={{ display: "grid", width: "100%", height: "100%", background, borderRadius: radius, overflow: "hidden" }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{ width: "100%", height: "100%",
            mixBlendMode: "lighten",
            objectFit: "contain", borderRadius: radius, display: "block" }}
        />
      </span>
    );
  };
}

export const TallinnCardIcon = imageIcon(tallinnCardSrc, "Tallinn Card", "#fa0000");
export const UlemisteCityIcon = imageIcon(ulemisteCitySrc, "Ülemiste City");
