import type { ReactNode } from "react";

export const metadata = {
  title: "КОЛЛ.GG",
  description: "Тактики для CS2: готовые раунды под твой уровень на FACEIT",
};

// Минимальный каркас. Токены дизайна, шрифты и общий layout — задача #21.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
