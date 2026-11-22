// Layout gốc: nạp CSS của Bootstrap, thanh điều hướng và khung trang.
import "bootstrap/dist/css/bootstrap.min.css";

import Nav from "../components/Nav";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-light">
        <Nav />

        <main className="container py-4">{children}</main>

        <footer className="text-center text-muted small py-4 border-top">
          Shop AI Agent — MVP demo, thanh toán giả lập, không thu tiền thật.
        </footer>
      </body>
    </html>
  );
}
