"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-blush p-6 text-center text-oxblood-dark">
    <div className="max-w-sm">
      <h1 className="text-xl font-black">باز کردن این صفحه ممکن نشد</h1>
      <p className="mt-2 text-sm leading-7 text-oxblood-dark/70">نمایش محصول به‌خاطر یک خطای داخلی متوقف شد. دوباره تلاش کنید.</p>
      <button type="button" onClick={reset} className="mt-5 rounded-lg bg-oxblood px-5 py-3 text-sm font-bold text-white">تلاش دوباره</button>
    </div>
  </main>;
}
