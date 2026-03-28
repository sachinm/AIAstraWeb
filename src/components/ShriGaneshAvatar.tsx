import shriGaneshImg from '../../images/shriGanesh.jpg';

type ShriGaneshAvatarProps = {
  /** Tailwind size classes, e.g. `h-10 w-10` */
  className?: string;
};

/**
 * Circular Shri Ganesh image from `images/shriGanesh.jpg` (repo root).
 * Uses `object-cover` and a slight top bias so a full-length murti reads well in a circle.
 */
export function ShriGaneshAvatar({ className = 'h-10 w-10' }: ShriGaneshAvatarProps) {
  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ring-2 ring-white/25 ${className}`}
    >
      <img
        src={shriGaneshImg}
        alt="Shri Ganesh"
        className="h-full w-full object-cover object-[center_20%]"
        width={80}
        height={80}
        decoding="async"
      />
    </div>
  );
}
