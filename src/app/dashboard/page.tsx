"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [totalRooms, setTotalRooms] = useState(0);
  const [occupiedRooms, setOccupiedRooms] = useState(0);
  const [vacantRooms, setVacantRooms] = useState(0);
  
  const [totalIncome, setTotalIncome] = useState(0);
  const [pendingBillsCount, setPendingBillsCount] = useState(0);
  const [pendingBillsTotal, setPendingBillsTotal] = useState(0);
  
  const [roomTypesStat, setRoomTypesStat] = useState<any[]>([]);
  const [missingMetersCount, setMissingMetersCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Rooms
      const { data: dbRooms } = await supabase.from('rooms').select('*');
      const rooms = dbRooms || [];
      
      const occupied = rooms.filter(r => r.status === 'occupied').length;
      const vacant = rooms.filter(r => r.status === 'vacant').length;
      
      setTotalRooms(rooms.length);
      setOccupiedRooms(occupied);
      setVacantRooms(vacant);

      // Group by room_type
      const typesMap: Record<string, { total: number, occupied: number }> = {};
      rooms.forEach(r => {
        const type = r.room_type || 'ทั่วไป';
        if (!typesMap[type]) typesMap[type] = { total: 0, occupied: 0 };
        typesMap[type].total += 1;
        if (r.status === 'occupied') typesMap[type].occupied += 1;
      });
      
      const stats = Object.keys(typesMap).map(type => ({
        type,
        total: typesMap[type].total,
        occupied: typesMap[type].occupied
      }));
      setRoomTypesStat(stats);

      // 2. Fetch Invoices for Current Month
      const d = new Date();
      const currentMonthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      const { data: dbInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('billing_month', currentMonthStr);
        
      const invoices = dbInvoices || [];
      
      let sumIncome = 0;
      let pendingCount = 0;
      let pendingSum = 0;
      
      invoices.forEach(inv => {
        const total = Number(inv.grand_total) || 0;
        sumIncome += total;
        if (!inv.is_paid) {
          pendingCount += 1;
          pendingSum += total;
        }
      });
      
      setTotalIncome(sumIncome);
      setPendingBillsCount(pendingCount);
      setPendingBillsTotal(pendingSum);
      
      // Calculate missing meters
      // Rooms that are occupied but don't have an invoice this month
      const invoicedRoomIds = invoices.map(i => i.room_id);
      const missing = rooms.filter(r => r.status === 'occupied' && !invoicedRoomIds.includes(r.id)).length;
      setMissingMetersCount(missing);

    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>กำลังโหลดข้อมูลแดชบอร์ด...</div>;
  }

  return (
    <div>
      <h1 className="page-title">แดชบอร์ดภาพรวม (Dashboard)</h1>

      {/* Top Cards */}
      <div className="grid-cards" style={{ marginBottom: "32px" }}>
        {/* Income Card */}
        <div className="card">
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ยอดรายรับเดือนนี้ (ประเมิน)</h3>
          <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>
            ฿ {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Room Status Card */}
        <div className="card">
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>สถานะห้องพัก (ทั้งหมด {totalRooms} ห้อง)</h3>
          <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>
            {occupiedRooms} <span style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: 400 }}>ห้องมีผู้เช่า</span>
          </div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: vacantRooms > 0 ? "var(--danger)" : "var(--success)" }}>
            {vacantRooms > 0 ? `ว่าง ${vacantRooms} ห้อง` : "ห้องเต็มทั้งหมด"}
          </div>
        </div>

        {/* Pending Bills Card */}
        <div className="card">
          <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>บิลรอชำระ (เดือนนี้)</h3>
          <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--text-primary)" }}>
            {pendingBillsCount} <span style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: 400 }}>บิล</span>
          </div>
          <div style={{ marginTop: "8px", fontSize: "13px", color: pendingBillsCount > 0 ? "var(--warning)" : "var(--success)" }}>
            {pendingBillsCount > 0 ? `ยอดรวม ฿ ${pendingBillsTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "ไม่มีบิลค้างชำระ"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        
        {/* Status by Room Type */}
        <div className="card">
          <h3 style={{ fontSize: "16px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>สถานะแต่ละประเภทห้องพัก</h3>
          
          {roomTypesStat.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: "14px", textAlign: "center", padding: "20px" }}>ยังไม่มีข้อมูลห้องพัก</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {roomTypesStat.map((stat, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{stat.type}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{stat.total} ห้อง</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {stat.occupied === stat.total ? (
                      <span className="badge badge-success">เต็ม {stat.occupied}/{stat.total}</span>
                    ) : (
                      <span className="badge badge-warning">ว่าง {stat.total - stat.occupied} ห้อง ({stat.occupied}/{stat.total})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* To-do List */}
        <div className="card">
          <h3 style={{ fontSize: "16px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>รายการรอดำเนินการ</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: missingMetersCount > 0 ? "var(--danger)" : "var(--success)" }}></div>
              <div>จดมิเตอร์น้ำไฟ {missingMetersCount > 0 ? `(ยังขาด ${missingMetersCount} ห้อง)` : `(ครบแล้ว)`}</div>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: pendingBillsCount > 0 ? "var(--warning)" : "var(--success)" }}></div>
              <div>ออกบิลประจำเดือน {pendingBillsCount > 0 ? `(รอดำเนินการ ${pendingBillsCount} บิล)` : `(ไม่มีบิลค้าง)`}</div>
            </div>
          </div>
          
          <Link href="/billing">
            <button className="btn-primary" style={{ marginTop: "24px", width: "100%", padding: "10px", backgroundColor: "var(--primary)", color: "white", borderRadius: "var(--radius-sm)", fontWeight: 500, fontSize: "14px", transition: "0.2s" }}>
              ไปหน้าจัดการบิล
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
