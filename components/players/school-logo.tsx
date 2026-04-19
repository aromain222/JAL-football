"use client";
import { useState } from "react";

export function SchoolLogo({ school, logoUrl, size = 20, className }: {
  school: string; logoUrl: string | null; size?: number; className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logoUrl} alt={`${school} logo`} width={size} height={size} className={className} onError={() => setFailed(true)} style={{ objectFit: "contain" }} />;
}
