import Image from "next/image";

export function PlaylistArtwork({
  urls,
  size = 9,
}: {
  urls: string[];
  /** Tailwind sizing unit — 9 = h-9 w-9 (36px), 12 = h-12 w-12 (48px) */
  size?: 9 | 12;
}) {
  const dim = `h-${size} w-${size}`;

  if (urls.length >= 4) {
    return (
      <div
        className={`grid ${dim} shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-md`}
      >
        {urls.slice(0, 4).map((url, i) => (
          <div key={i} className="relative">
            <Image src={url} alt="" fill className="object-cover" unoptimized />
          </div>
        ))}
      </div>
    );
  }

  if (urls.length > 0) {
    return (
      <div className={`relative ${dim} shrink-0 overflow-hidden rounded-md`}>
        <Image src={urls[0]} alt="" fill className="object-cover" unoptimized />
      </div>
    );
  }

  return <div className={`${dim} shrink-0 rounded-md bg-white/[0.06]`} />;
}
