"use client";
// Trang tài khoản: xem thông tin của chính mình (GET /auth/me).
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, getStoredUser } from "../../lib/api";

type Me = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
};

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ưu tiên dữ liệu tươi từ API; nếu API lỗi thì dùng dữ liệu
    // đã lưu lúc đăng nhập để vẫn hiển thị được tên và email.
    api("/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => {
        const stored = getStoredUser();
        if (stored) {
          setMe({
            id: stored.id,
            email: stored.email,
            name: stored.name,
            roles: stored.roles,
            permissions: [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="alert alert-warning">
        Cần đăng nhập để xem tài khoản.{" "}
        <Link href="/login" className="alert-link">
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-7">
        <h2 className="mb-3">Tài khoản của tôi</h2>
        <div className="card">
          <div className="card-body">
            <dl className="row mb-0">
              <dt className="col-sm-4">Tên</dt>
              <dd className="col-sm-8">{me.name}</dd>
              <dt className="col-sm-4">Email</dt>
              <dd className="col-sm-8">{me.email}</dd>
              <dt className="col-sm-4">Vai trò</dt>
              <dd className="col-sm-8">
                {me.roles.map((role) => (
                  <span key={role} className="badge bg-primary me-1">
                    {role}
                  </span>
                ))}
              </dd>
              {me.permissions.length > 0 && (
                <>
                  <dt className="col-sm-4">Quyền</dt>
                  <dd className="col-sm-8">
                    {me.permissions.map((permission) => (
                      <span key={permission} className="badge bg-secondary me-1 mb-1">
                        {permission}
                      </span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="mt-3 d-flex gap-2">
          <Link href="/orders" className="btn btn-outline-primary">
            Đơn hàng của tôi
          </Link>
          <Link href="/" className="btn btn-outline-secondary">
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
