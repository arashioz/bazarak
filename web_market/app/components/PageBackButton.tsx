"use client";

import { ArrowRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const mainPages = new Set(["/", "/products", "/customers", "/catalog", "/mobile-services", "/modir/panel", "/modir/login"]);

export default function PageBackButton() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const catalogCategory = pathname === "/catalog" && Boolean(searchParams.get("category"));
  if (mainPages.has(pathname) && !catalogCategory) return null;
  const goBack = () => {
    const parent = catalogCategory ? "/catalog" : pathname.slice(0, pathname.lastIndexOf("/")) || "/";
    router.push(parent);
  };
  return <button type="button" onClick={goBack} className="fixed left-3 top-3 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-full border border-oxblood/15 bg-white/95 text-oxblood shadow-md backdrop-blur transition hover:bg-blush" aria-label="بازگشت"><ArrowRight size={19}/></button>;
}
