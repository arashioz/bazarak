"use client";

import { ArrowRight } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export default function PageBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/") return null;
  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/catalog");
  };
  return <button type="button" onClick={goBack} className="fixed left-3 top-3 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-full border border-oxblood/15 bg-white/95 text-oxblood shadow-md backdrop-blur transition hover:bg-blush" aria-label="بازگشت"><ArrowRight size={19}/></button>;
}
