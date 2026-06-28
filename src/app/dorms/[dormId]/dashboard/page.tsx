'use client';
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

export default function Dashboard() {
  const params = useParams();
  const dormId = params.dormId as string;
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [reports, setReports] = useState({ 
    totalBilledRooms: 0, 
    totalBilledAmount: 0,
    totalCollected: 0,
    totalExpenses: 0,
    netProfit: 0,
    unpaidInvoices: [] as any[]
  });

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
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
      
      let totalBilledAmt = 0;
      let totalCollectedAmt = 0;
      let billedRoomsCount = 0;
      let unpaidList: any[] = [];
      let totalExp = 0;

      if (roomsData && roomsData.length > 0) {
        const { data: invoicesData } = await supabase.from('invoices')
          .select('grand_total, room_id, is_paid, invoice_no, issue_date')
          .eq('billing_month', currentMonth)
          .in('room_id', roomsData.map(r => r.id));
          
        if (invoicesData) {
          billedRoomsCount = invoicesData.length;
          invoicesData.forEach(inv => {
            const amt = Number(inv.grand_total) || 0;
            totalBilledAmt += amt;
            if (inv.is_paid) {
              totalCollectedAmt += amt;
            } else {
              unpaidList.push(inv);
            }
          });
        }
      }

      const { data: expensesData } = await supabase.from('expenses')
        .select('amount')
        .eq('dorm_id', dormId)
        .gte('expense_date', firstDay)
        .lte('expense_date', lastDay);

      if (expensesData) {
        totalExp = expensesData.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
      }

      setReports({
        totalBilledRooms: billedRoomsCount,
        totalBilledAmount: totalBilledAmt,
        totalCollected: totalCollectedAmt,
        totalExpenses: totalExp,
        netProfit: totalCollectedAmt - totalExp,
        unpaidInvoices: unpaidList
      });

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
      <h1 className="page-title">แดชบอร์ดสรุป (Dashboard) - ประจำเดือนนี้</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ยอดบิลทั้งหมด (บาท)</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{reports.totalBilledAmount.toLocaleString()}</p>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--success)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>เก็บเงินได้แล้ว (บาท)</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--success)" }}>{reports.totalCollected.toLocaleString()}</p>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>รายจ่ายรวม (บาท)</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--danger)" }}>{reports.totalExpenses.toLocaleString()}</p>
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--warning)", backgroundColor: reports.netProfit >= 0 ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)" }}>
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>กำไร/ขาดทุน สุทธิ (บาท)</h3>
          <p style={{ fontSize: "28px", fontWeight: 700, color: reports.netProfit >= 0 ? "var(--success)" : "var(--danger)" }}>
            {reports.netProfit >= 0 ? "+" : ""}{reports.netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        <div className="card">
          <h3 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--danger)" }}>
            🔴 รายชื่อห้องที่ยังไม่ชำระเงิน ({reports.unpaidInvoices.length} ห้อง)
          </h3>
          {reports.unpaidInvoices.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-sm)" }}>
              ไม่มีห้องค้างชำระในเดือนนี้ 🎉
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    <th style={{ padding: "12px 8px" }}>ห้อง</th>
                    <th style={{ padding: "12px 8px" }}>เลขที่บิล</th>
                    <th style={{ padding: "12px 8px" }}>วันที่ออกบิล</th>
                    <th style={{ padding: "12px 8px", textAlign: "right" }}>ยอดค้างชำระ (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.unpaidInvoices.map((inv, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "12px 8px", fontWeight: 600 }}>{inv.room_id}</td>
                      <td style={{ padding: "12px 8px", color: "var(--text-secondary)" }}>{inv.invoice_no || "-"}</td>
                      <td style={{ padding: "12px 8px" }}>{new Date(inv.issue_date).toLocaleDateString('th-TH')}</td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600, color: "var(--danger)" }}>
                        {Number(inv.grand_total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="card" style={{ borderTop: "4px solid var(--primary)" }}>
            <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ความคืบหน้าการออกบิล</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <span style={{ fontSize: "28px", fontWeight: 700 }}>{reports.totalBilledRooms}</span>
              <span style={{ color: "var(--text-secondary)", marginBottom: "6px" }}>/ {rooms.length} ห้อง</span>
            </div>
            <div style={{ marginTop: "12px", width: "100%", backgroundColor: "var(--border-color)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ 
                width: `${rooms.length > 0 ? (reports.totalBilledRooms / rooms.length) * 100 : 0}%`, 
                backgroundColor: "var(--primary)", 
                height: "100%" 
              }}></div>
            </div>
          </div>

          <div className="card" style={{ borderTop: "4px solid var(--warning)" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              ⚠️ ห้องที่ใกล้ถึงรอบออกบิล (ภายใน 3 วัน)
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
      </div>
    </div>
  );
}

