import "./globals.css";
import ApiLoadingOverlay from "./components/ApiLoadingOverlay";
import PageBackButton from "./components/PageBackButton";
export const metadata = { title: "بازارک", description: "سامانه قیمت محصولات" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="fa" dir="rtl"><body><ApiLoadingOverlay><PageBackButton />{children}</ApiLoadingOverlay></body></html>; }
