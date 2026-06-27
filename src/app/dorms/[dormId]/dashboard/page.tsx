'use client';
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

export default function Dashboard() {
  const params = useParams();
  const dormId = params.dormId as string;
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reports, setReports] = useState({ totalBilled: 0, totalAmount: 0 });

  useEffect(() => {
    fetchData();
  }, [dormId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: roomsData } = await supabase.from('rooms').select('*').eq('dorm_id', dormId).order('id');
      if (roomsData) setRooms(roomsData);

      const d = new Date();
      const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (roomsData && roomsData.length > 0) {
        const { data: invoicesData } = await supabase.from('invoices')
          .select('grand_total, room_id')
          .eq('billing_month', currentMonth)
          .in('room_id', roomsData.map(r => r.id));
          
        if (invoicesData) {
          const totalAmt = invoicesData.reduce((sum, inv) => sum + (Number(inv.grand_total) || 0), 0);
          setReports({ totalBilled: invoicesData.length, totalAmount: totalAmt });
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ padding: "20px" }}>กำลังโหลดข้อมูล...</div>;

  // การแจ้งเตือนห้องที่ใกล้ถึงรอบออกบิล (ล่วงหน้า 3 วัน)
  const today = new Date().getDate();
  const upcomingBillingRooms = rooms.filter(room => {
    const billDate = room.billing_cycle_date;
    if (!billDate) return false;
    let diff = billDate - today;
    if (diff < 0) diff += 30; // ข้ามไปเดือนหน้า
    return diff <= 3 && diff >= 0;
  });

  return (
    <div>
      <h1 className="page-title">แดชบอร์ดสรุป (Dashboard)</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginBottom: "24px" }}>
        <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>จำนวนห้องทั้งหมด</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{rooms.length}</p>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--success)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ห้องที่ออกบิลแล้วเดือนนี้</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{reports.totalBilled} / {rooms.length}</p>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ยอดรวมบิลเดือนนี้ (บาท)</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{reports.totalAmount.toLocaleString()}</p>
        </div>
      </div>

      <div className="card" style={{ borderTop: "4px solid var(--warning)" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          ⚠️ แจ้งเตือน: ห้องที่ใกล้ถึงรอบออกบิล (ภายใน 3 วัน)
        </h3>
        {upcomingBillingRooms.length === 0 ? (
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>ไม่มีห้องที่ใกล้ถึงรอบออกบิล</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {upcomingBillingRooms.map(room => (
              <div key={room.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-sm)" }}>
                <div>
                  <span style={{ fontWeight: 600 }}>ห้อง {room.id}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "13px", marginLeft: "12px" }}>รอบบิลวันที่: {room.billing_cycle_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
