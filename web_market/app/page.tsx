import Link from "next/link";
import { BookOpen, Search, ShieldCheck, Users } from "lucide-react";
import BrandLogo from "./components/BrandLogo";

const sections = [
  { href: "/customers", title: "مشتریان", description: "فهرست مشتریان، اطلاعات تماس و پیگیری‌ها", icon: Users },
  { href: "/products", title: "محصولات", description: "جستجو و مشاهده قیمت محصولات", icon: Search },
  { href: "/catalog", title: "کاتالوگ", description: "کاتالوگ کامل محصولات", icon: BookOpen },
  { href: "/modir/panel", title: "مدیریت", description: "مدیریت محصولات و تنظیمات برنامه", icon: ShieldCheck },
];

export default function Page() {
  return <main className="flex min-h-[calc(100dvh-3rem)] items-center bg-blush px-4 py-12 text-oxblood-dark sm:px-6">
    <div className="mx-auto w-full max-w-5xl">
      <BrandLogo />
      <h1 className="mt-12 text-2xl font-extrabold sm:text-4xl">کدام بخش را می‌خواهید؟</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="rounded-2xl border border-oxblood/10 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-oxblood/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-oxblood">
          <Icon className="mb-7 text-oxblood" size={25} />
          <b className="block text-xl">{title}</b>
          <span className="mt-2 block text-sm leading-7 text-oxblood-dark/60">{description}</span>
        </Link>)}
      </div>
    </div>
  </main>;
}
