"use client";
import { useState } from "react";
import Image from "next/image";

export function PlayerPhoto({ src, alt, initials, size = 64 }: {
  src: string; alt: string; initials: string; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_30%_30%,rgba(211,178,108,0.35),rgba(255,255,255,0.06)_45%,rgba(0,0,0,0.28))] text-lg font-bold text-[#f0e4c0] shadow-inner" style={{ width: size, height: size }}>
        {initials}
      </div>
    );
  }
  return (
    <div className="relative shrink-0 overflow-hidden rounded-2xl border border-white/15 shadow-inner" style={{ width: size, height: size }}>
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover object-top" onError={() => setFailed(true)} />
    </div>
  );
}
