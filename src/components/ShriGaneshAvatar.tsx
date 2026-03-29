const shriGaneshPublicSrc = `${import.meta.env.BASE_URL}images/shriGanesh.jpg`;

type ShriGaneshAvatarProps = {
  /** Tailwind size classes, e.g. `h-10 w-10` */
  className?: string;
  /** Ring around the circle (thinner for very small sizes). */
  ringClassName?: string;
};

/**
 * Circular Shri Ganesh image from `public/images/shriGanesh.jpg`.
 * Uses `object-cover` with a slight top bias so a full-length murti reads well in a circle.
 */
export function ShriGaneshAvatar({
  className = 'h-10 w-10',
  ringClassName = 'ring-2 ring-white/25',
}: ShriGaneshAvatarProps) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${ringClassName} ${className}`.trim()}
    >
      <img
        src={shriGaneshPublicSrc}
        alt="Shri Ganesh"
        className="h-full w-full object-cover object-[center_20%]"
        width={80}
        height={80}
        decoding="async"
      />
    </div>
  );
}
