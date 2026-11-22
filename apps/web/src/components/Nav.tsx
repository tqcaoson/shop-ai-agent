// Thanh điều hướng dùng Bootstrap.
//
// Trạng thái đăng nhập chỉ được đọc sau khi component đã mount
// (trong useEffect), để lần render đầu tiên ở client giống hệt
// HTML do server render — tránh lỗi hydration mismatch.
// Sau đó Nav lắng nghe sự kiện "auth-changed" để cập nhật ngay
// khi user đăng nhập/đăng xuất mà không cần tải lại trang.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { clearAuth, getStoredUser, type StoredUser } from "../lib/api";

const LINKS = [
  { href: "/", label: "Sản phẩm" },
  { href: "/cart", label: "Giỏ hàng" },
  { href: "/orders", label: "Đơn hàng" },
  { href: "/chat", label: "Chat AI" },
  // Chỉ hiện với ADMIN/STAFF sau khi đã mount (xem visibleLinks bên dưới).
  { href: "/admin", label: "Quản trị", staffOnly: true },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  // Chưa mount thì coi như chưa đăng nhập, giống hệt bản server render.
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  // Menu mobile đóng/mở bằng state của React, không cần Bootstrap JS.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setUser(getStoredUser());
    refresh();
    setMounted(true);
    window.addEventListener("auth-changed", refresh);
    return () => window.removeEventListener("auth-changed", refresh);
  }, []);

  const logout = () => {
    clearAuth();
    router.push("/");
  };

  // Chưa mount thì hiện đủ link (giống bản server render, tránh lỗi
  // hydration). Sau khi mount, link Quản trị chỉ hiện với ADMIN/STAFF.
  const isStaff = user?.roles?.some((role) => role === "ADMIN" || role === "STAFF");
  const visibleLinks = LINKS.filter((link) => !link.staffOnly || !mounted || isStaff);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
      <div className="container">
        <Link className="navbar-brand fw-bold" href="/">
          🛍️ Shop AI Agent
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-controls="mainNav"
          aria-expanded={menuOpen}
          aria-label="Mở menu"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className={`collapse navbar-collapse${menuOpen ? " show" : ""}`} id="mainNav">
          <ul className="navbar-nav me-auto">
            {visibleLinks.map((link) => (
              <li className="nav-item" key={link.href}>
                <Link
                  className={`nav-link${pathname === link.href ? " active" : ""}`}
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="d-flex align-items-center gap-2">
            {mounted && user ? (
              <>
                <span className="navbar-text text-white me-1">
                  Xin chào,{" "}
                  <Link href="/account" className="link-light fw-bold">
                    {user.name}
                  </Link>
                  {user.roles?.includes("ADMIN") && (
                    <span className="badge bg-warning text-dark ms-2">ADMIN</span>
                  )}
                  {user.roles?.includes("STAFF") && (
                    <span className="badge bg-info text-dark ms-2">STAFF</span>
                  )}
                </span>
                <button className="btn btn-outline-light btn-sm" onClick={logout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <Link className="btn btn-light btn-sm" href="/login">
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
