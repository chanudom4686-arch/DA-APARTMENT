'use client';
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

export default function Dashboard() {
  const params = useParams();
  const dormId = params.dormId as string;
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });

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
  }, [dormId, fromDate, toDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: roomsData } = await supabase.from('rooms').select('*').eq('dorm_id', dormId).order('id');
      if (roomsData) setRooms(roomsData);

      const d = new Date();
      
      let totalBilledAmt = 0;
      let totalCollectedAmt = 0;
      let billedRoomsCount = 0;
      let unpaidList: any[] = [];
      let totalExp = 0;

      if (roomsData && roomsData.length > 0) {
        let invoicesQuery = supabase.from('invoices')
          .select('grand_total, room_id, is_paid, invoice_no, issue_date')
          .in('room_id', roomsData.map(r => r.id));
          
        if (fromDate) invoicesQuery = invoicesQuery.gte('issue_date', fromDate);
        if (toDate) invoicesQuery = invoicesQuery.lte('issue_date', toDate);
          
        const { data: invoicesData } = await invoicesQuery;
          
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

      let expensesQuery = supabase.from('expenses')
        .select('amount')
        .eq('dorm_id', dormId);
        
      if (fromDate) expensesQuery = expensesQuery.gte('expense_date', fromDate);
      if (toDate) expensesQuery = expensesQuery.lte('expense_date', toDate);

      const { data: expensesData } = await expensesQuery;

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

  const sendLineSummary = async () => {
    if (reports.unpaidInvoices.length === 0 && upcomingBillingRooms.length === 0) {
      alert("ไม่มีข้อมูลที่จะส่งแจ้งเตือนครับ");
      return;
    }
    
    setIsSending(true);
    try {
      let message = `📊 สรุปข้อมูลประจำวันหอพัก\n\n`;
      
      message += `🔴 ห้องที่ค้างชำระ (${reports.unpaidInvoices.length} ห้อง):\n`;
      if (reports.unpaidInvoices.length > 0) {
        reports.unpaidInvoices.forEach(inv => {
          message += `- ห้อง ${inv.room_id}: ${Number(inv.grand_total).toLocaleString()} บาท\n`;
        });
      } else {
        message += `- ไม่มีห้องค้างชำระ\n`;
      }

      message += `\n⚠️ ห้องที่ใกล้ถึงรอบบิลใน 3 วัน (${upcomingBillingRooms.length} ห้อง):\n`;
      if (upcomingBillingRooms.length > 0) {
        upcomingBillingRooms.forEach(room => {
          message += `- ห้อง ${room.id} (รอบวันที่ ${room.billing_cycle_date})\n`;
        });
      } else {
        message += `- ไม่มีห้องที่ใกล้ถึงรอบบิล\n`;
      }

      message += `\nเช็คข้อมูลเพิ่มเติมได้ที่ระบบจัดการหอพัก`;

      const res = await fetch('/api/notify-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await res.json();
      if (data.success) {
        alert('ส่งสรุปข้อมูลเข้า LINE สำเร็จ!');
      } else {
        alert('เกิดข้อผิดพลาด: ' + data.error);
      }
    } catch (error) {
      console.error(error);
      alert('ไม่สามารถส่งข้อมูลเข้า LINE ได้');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 className="page-title" style={{ margin: 0 }}>แดชบอร์ดสรุป (Dashboard)</h1>
            <button 
              onClick={sendLineSummary}
              disabled={isSending}
              style={{
                backgroundColor: isSending ? "#ccc" : "#06C755", // LINE Green color
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "6px 12px",
                fontSize: "14px",
                cursor: isSending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 500
              }}
            >
              {isSending ? "กำลังส่ง..." : "📱 ส่งสรุปเข้า LINE"}
            </button>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px" }}>
            ข้อมูลตั้งแต่วันที่ {new Date(fromDate).toLocaleDateString('th-TH')} ถึง {new Date(toDate).toLocaleDateString('th-TH')}
          </p>
        </div>
        
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่เริ่มต้น</label>
            <input 
              type="date" 
              value={fromDate} 
              onChange={e => setFromDate(e.target.value)} 
              style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none" }} 
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่สิ้นสุด</label>
            <input 
              type="date" 
              value={toDate} 
              onChange={e => setToDate(e.target.value)} 
              style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none" }} 
            />
          </div>
        </div>
      </div>

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

