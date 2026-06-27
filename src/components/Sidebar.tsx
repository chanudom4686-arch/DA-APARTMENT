'use client';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";

export default function Sidebar({ dormId }: { dormId?: string }) {
  const pathname = usePathname();
  const [dormName, setDormName] = useState("");

  useEffect(() => {
    if (dormId) {
      supabase.from('dormitories').select('name').eq('id', dormId).single().then(({ data }) => {
        if (data) setDormName(data.name);
      });
    }
  }, [dormId]);

  if (!dormId) return null;

  return (
    <aside className="sidebar" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ color: "var(--primary)", fontSize: "20px" }}>{dormName || "DormMaster"}</h2>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        <Link href={`/dorms/${dormId}/dashboard`} className={`nav-item ${pathname === `/dorms/${dormId}/dashboard` ? "active" : ""}`}>
          📊 แดชบอร์ดสรุป
        </Link>
        <Link href={`/dorms/${dormId}/rooms`} className={`nav-item ${pathname === `/dorms/${dormId}/rooms` ? "active" : ""}`}>
          🚪 จัดการห้องพัก
        </Link>
        <Link href={`/dorms/${dormId}/meters`} className={`nav-item ${pathname === `/dorms/${dormId}/meters` ? "active" : ""}`}>
          📝 จดมิเตอร์น้ำ-ไฟ
        </Link>
        <Link href={`/dorms/${dormId}/billing`} className={`nav-item ${pathname === `/dorms/${dormId}/billing` ? "active" : ""}`}>
          🧾 ออกบิลและใบเสร็จ
        </Link>
        <Link href={`/dorms/${dormId}/special-billing`} className={`nav-item ${pathname.includes('/special-billing') ? 'active' : ''}`}>
          ⭐ ออกบิลพิเศษ
        </Link>
        <Link href={`/dorms/${dormId}/reports`} className={`nav-item ${pathname.includes('/reports') ? 'active' : ''}`}>
          📈 รายงานและรายจ่าย
        </Link>
      </nav>

      <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
        <Link href="/" className="nav-item" style={{ color: "var(--danger)" }}>
          🔙 กลับหน้าเลือกหอพัก
        </Link>
      </div>
    </aside>
  );
}
