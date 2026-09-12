"use client";

import Link from "next/link";
import { BookOpen, LayoutDashboard, LogOut, Truck, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/modir/panel", label: "پنل", icon: LayoutDashboard },
  { href: "/customers", label: "مشتریان", icon: Users },
  { href: "/mobile-services", label: "خدمات", icon: Truck },
  { href: "/catalog", label: "کاتالوگ", icon: BookOpen },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/modir/login");
  };
  return <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-oxblood/10 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgb(80_25_30_/_0.08)] backdrop-blur sm:hidden">
    {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`grid min-w-0 place-items-center gap-1 px-2 text-[10px] font-bold ${pathname === href || (href !== "/modir/panel" && pathname.startsWith(`${href}/`)) ? "text-oxblood" : "text-oxblood/45"}`}><Icon size={19}/><span>{label}</span></Link>)}
    <button type="button" onClick={() => void logout()} className="grid place-items-center gap-1 px-2 text-[10px] font-bold text-oxblood/45"><LogOut size={19}/><span>خروج</span></button>
  </nav>;
}
