import "./globals.css";
export const metadata = { title: "بازارک", description: "سامانه قیمت محصولات" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fa" dir="rtl"><body>{children}</body></html>; }
