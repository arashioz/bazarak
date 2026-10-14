import "./globals.css";
import ApiLoadingOverlay from "./components/ApiLoadingOverlay";
import PageBackButton from "./components/PageBackButton";
import { Suspense } from "react";
import localFont from "next/font/local";
const estedad = localFont({ src: "../public/fonts/Estedad.woff2", variable: "--font-estedad", display: "swap", weight: "100 900" });
export const metadata = { title: "بازارک", description: "سامانه قیمت محصولات" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fa" dir="rtl" className={estedad.variable}><body><ApiLoadingOverlay><Suspense><PageBackButton /></Suspense>{children}<footer className="app-credit">آریو (نسخه آسیاب صداقت)</footer></ApiLoadingOverlay></body></html>; }
