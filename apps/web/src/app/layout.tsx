import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui", maxWidth: 960, margin: "0 auto", padding: 20 }}>
        <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Link href="/">Sản phẩm</Link>
          <Link href="/cart">Giỏ hàng</Link>
          <Link href="/orders">Đơn hàng</Link>
          <Link href="/chat">Chat AI</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/login">Đăng nhập</Link>
        </nav>

        {children}
      </body>
    </html>
  );
}
