"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import styles from "./SiteHeader.module.css";

const NavigationLink = () => (
  <Link className={styles.navLink} href="/" aria-current="page">
    Тактики
  </Link>
);

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <header className={`site-shell ${styles.header}`}>
      <Link className={styles.logo} href="/" aria-label="КОЛЛ.GG — на главную">
        КОЛЛ<span>.GG</span>
      </Link>

      <nav className={styles.desktopNav} aria-label="Основная навигация">
        <NavigationLink />
      </nav>

      <label className={styles.search}>
        <span className="visually-hidden">Поиск</span>
        <input disabled placeholder="Поиск скоро появится" type="search" />
      </label>

      <button
        ref={triggerRef}
        className={styles.menuButton}
        type="button"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? "Закрыть меню" : "Открыть меню"}
      </button>

      {menuOpen ? (
        <nav className={styles.mobileNav} aria-label="Мобильная навигация">
          <NavigationLink />
          <button className={styles.closeButton} type="button" onClick={closeMenu}>
            Закрыть
          </button>
        </nav>
      ) : null}
    </header>
  );
}
