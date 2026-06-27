"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

export default function Reports() {
  const params = useParams();
  const dormId = params.dormId as string;

  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [invoices, setInvoices] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [roomStats, setRoomStats] = useState({ total: 0, occupied: 0, vacant: 0 });

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ date: "", title: "", amount: 0, note: "", category: "general" });
  const [savingExpense, setSavingExpense] = useState(false);

  const [showSaveReportModal, setShowSaveReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [savingReport, setSavingReport] = useState(false);

  useEffect(() => {
    // Set default to current month (1st to last day)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(lastDay.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (fromDate && toDate && dormId) {
      fetchReportData();
    }
  }, [fromDate, toDate, dormId]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch rooms first to map dorm
      const { data: roomsData } = await supabase.from('rooms').select('id, status').eq('dorm_id', dormId);
      const roomIds = roomsData ? roomsData.map(r => r.id) : [];
      
      if (roomsData) {
        setRoomStats({
          total: roomsData.length,
          occupied: roomsData.filter(r => r.status === 'occupied').length,
          vacant: roomsData.filter(r => r.status === 'vacant').length
        });
      }

      if (roomIds.length > 0) {
        const { data: invs } = await supabase
          .from('invoices')
          .select('*')
          .in('room_id', roomIds)
          .gte('issue_date', fromDate)
          .lte('issue_date', toDate);
        setInvoices(invs || []);
      } else {
        setInvoices([]);
      }

      const { data: exps } = await supabase
        .from('expenses')
        .select('*')
        .eq('dorm_id', dormId)
        .gte('expense_date', fromDate)
        .lte('expense_date', toDate)
        .order('expense_date', { ascending: false });
      setExpenses(exps || []);

      const { data: reports } = await supabase
        .from('saved_reports')
        .select('*')
        .eq('dorm_id', dormId)
        .order('created_at', { ascending: false });
      setSavedReports(reports || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        dorm_id: dormId,
        expense_date: expenseForm.date,
        title: expenseForm.title,
        amount: Number(expenseForm.amount),
        note: expenseForm.note,
        category: expenseForm.category || 'general'
      });
      if (error) throw error;
      
      setShowExpenseModal(false);
      setExpenseForm({ date: "", title: "", amount: 0, note: "", category: "general" });
      fetchReportData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSavingExpense(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("ต้องการลบรายจ่ายนี้หรือไม่?")) return;
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      setExpenses(expenses.filter(ex => ex.id !== id));
    } catch (err) {
      alert("ลบไม่สำเร็จ");
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReport(true);
    try {
      const { error } = await supabase.from('saved_reports').insert({
        dorm_id: dormId,
        title: reportTitle,
        from_date: fromDate,
        to_date: toDate
      });
      if (error) throw error;
      
      setShowSaveReportModal(false);
      setReportTitle("");
      fetchReportData();
    } catch (err: any) {
      alert("ไม่สามารถบันทึกรายงานได้: " + err.message);
    } finally {
      setSavingReport(false);
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm("ต้องการลบประวัติรายงานนี้หรือไม่?")) return;
    try {
      const { error } = await supabase.from('saved_reports').delete().eq('id', id);
      if (error) throw error;
      fetchReportData();
    } catch (err) {
      alert("ลบไม่สำเร็จ");
    }
  };

  // Calculations
  const stats = invoices.reduce((acc, inv) => {
    acc.elecUnits += ((inv.current_elec || 0) - (inv.prev_elec || 0)) + ((inv.current_elec_b || 0) - (inv.prev_elec_b || 0));
    acc.waterUnits += ((inv.current_water || 0) - (inv.prev_water || 0));
    
    acc.incomeRoom += Number(inv.room_price) || 0;
    acc.incomeElec += Number(inv.elec_total) || 0;
    acc.incomeWater += Number(inv.water_total) || 0;
    acc.incomeCommon += Number(inv.common_fee_total) || 0;
    acc.incomeOther += Number(inv.other_total) || 0;
    
    acc.totalBilled += Number(inv.grand_total) || 0;
    if (inv.is_paid) {
      acc.totalCollected += Number(inv.grand_total) || 0;
      acc.paidCount++;
    } else {
      acc.unpaidAmount += Number(inv.grand_total) || 0;
      acc.unpaidCount++;
    }

    return acc;
  }, {
    elecUnits: 0, waterUnits: 0,
    incomeRoom: 0, incomeElec: 0, incomeWater: 0, incomeCommon: 0, incomeOther: 0,
    totalBilled: 0, totalCollected: 0, unpaidAmount: 0, paidCount: 0, unpaidCount: 0
  });

  const totalExpenses = expenses.reduce((sum, ex) => sum + Number(ex.amount), 0);
  const netProfit = stats.totalCollected - totalExpenses; // Profit based on collected money

  const officialElecAmount = expenses.filter(e => e.category === 'official_elec').reduce((s, e) => s + Number(e.amount), 0);
  const officialWaterAmount = expenses.filter(e => e.category === 'official_water').reduce((s, e) => s + Number(e.amount), 0);
  
  const utilProfitElec = stats.incomeElec - officialElecAmount;
  const utilProfitWater = stats.incomeWater - officialWaterAmount;

  // Export to CSV (Excel compatible)
  const exportToExcel = () => {
    // Add UTF-8 BOM for Thai characters
    let csvContent = "\uFEFF";
    
    // Header
    csvContent += "วันที่ออกบิล,เลขที่บิล,ห้อง,ค่าเช่า,ค่าไฟ,ค่าน้ำ,ค่าส่วนกลาง,ค่าอื่นๆ,ยอดรวม,สถานะ\n";
    
    // Data
    invoices.forEach(inv => {
      const date = inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('th-TH') : '-';
      const no = inv.invoice_no || '-';
      const room = inv.room_id || '-';
      const rent = Number(inv.room_price) || 0;
      const elec = Number(inv.elec_total) || 0;
      const water = Number(inv.water_total) || 0;
      const common = Number(inv.common_fee_total) || 0;
      const other = Number(inv.other_total) || 0;
      const total = Number(inv.grand_total) || 0;
      const status = inv.is_paid ? "ชำระแล้ว" : "รอชำระ";
      
      csvContent += `${date},${no},${room},${rent},${elec},${water},${common},${other},${total},${status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 className="page-title" style={{ margin: 0 }}>รายงานและรายจ่าย (Reports & Expenses)</h1>
        <div style={{ display: "flex", gap: "12px" }}>
          <button onClick={() => window.print()} className="btn btn-dark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            ออกรายงาน (PDF)
          </button>
          <button onClick={exportToExcel} className="btn btn-success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            ออกรายงาน (EXCEL)
          </button>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>ค้นหารายงาน</h3>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่เริ่มต้น</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input-field" style={{ minWidth: "200px" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่สิ้นสุด</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input-field" style={{ minWidth: "200px" }} />
              </div>
              <button onClick={fetchReportData} className="btn btn-primary" style={{ padding: "10px 24px" }}>
                🔍 ค้นหา
              </button>
              <button onClick={() => setShowSaveReportModal(true)} className="btn btn-outline" style={{ padding: "10px 24px" }} disabled={invoices.length === 0 && expenses.length === 0}>
                💾 บันทึกรายงานนี้
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* แถบประวัติการออกรายงาน */}
      <div className="card no-print" style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "var(--text-primary)" }}>📁 ประวัติรายงานที่บันทึกไว้</h3>
        {savedReports.length === 0 ? (
          <div style={{ fontSize: "14px", color: "var(--text-muted)", padding: "4px 0" }}>ยังไม่มีรายงานที่บันทึกไว้</div>
        ) : (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {savedReports.map(report => (
              <div key={report.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", backgroundColor: "var(--bg-main)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                <button 
                  onClick={() => {
                    setFromDate(report.from_date);
                    setToDate(report.to_date);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--primary)", fontWeight: 500, fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span>📄</span> {report.title}
                </button>
                <button onClick={() => deleteReport(report.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px", marginLeft: "4px" }} title="ลบรายงาน">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>กำลังโหลดรายงาน...</div>
      ) : (
        <>
          {/* Executive Summary Dashboard */}
          <div className="grid-cards" style={{ marginBottom: "24px", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {/* สถิติห้องพัก */}
            <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
              <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>🏠 สถานะห้องพัก</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{roomStats.total}</span>
                  <span style={{ fontSize: "14px", color: "var(--text-muted)" }}> ห้องทั้งหมด</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", textAlign: "right" }}>
                  <div>มีผู้เช่า: <span style={{ color: "var(--primary)", fontWeight: 600 }}>{roomStats.occupied}</span></div>
                  <div>ว่าง: <span style={{ color: "var(--success)", fontWeight: 600 }}>{roomStats.vacant}</span></div>
                </div>
              </div>
            </div>

            {/* สถิติบิล */}
            <div className="card" style={{ borderLeft: "4px solid var(--info)" }}>
              <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>🧾 สถิติบิล</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{invoices.length}</span>
                  <span style={{ fontSize: "14px", color: "var(--text-muted)" }}> บิลทั้งหมด</span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", textAlign: "right" }}>
                  <div>ชำระแล้ว: <span style={{ color: "var(--success)", fontWeight: 600 }}>{stats.paidCount}</span></div>
                  <div>ค้างชำระ: <span style={{ color: "var(--danger)", fontWeight: 600 }}>{stats.unpaidCount}</span></div>
                </div>
              </div>
            </div>

            {/* ยอดค้างชำระรวม */}
            <div className="card" style={{ borderLeft: "4px solid var(--danger)", backgroundColor: stats.unpaidAmount > 0 ? "var(--danger-light)" : "white" }}>
              <h3 style={{ fontSize: "14px", color: "var(--danger)", marginBottom: "8px", fontWeight: 600 }}>⚠️ ยอดค้างชำระรวม</h3>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--danger)" }}>
                {stats.unpaidAmount.toLocaleString()} ฿
              </p>
            </div>
          </div>

          <div className="grid-cards" style={{ marginBottom: "24px", gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
              <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ยอดใช้น้ำประปารวม (หน่วย)</h3>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{stats.waterUnits}</p>
            </div>
            <div className="card" style={{ borderLeft: "4px solid var(--warning)" }}>
              <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>ยอดใช้ไฟฟ้ารวม (หน่วย)</h3>
              <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)" }}>{stats.elecUnits}</p>
            </div>
            <div className="card" style={{ borderLeft: netProfit >= 0 ? "4px solid var(--success)" : "4px solid var(--danger)" }}>
              <h3 style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>กำไรสุทธิ (รายรับชำระแล้ว - รายจ่าย)</h3>
              <p style={{ fontSize: "28px", fontWeight: 700, color: netProfit >= 0 ? "var(--success)" : "var(--danger)" }}>
                {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })} ฿
              </p>
            </div>
          </div>

          {/* วิเคราะห์กำไรค่าน้ำ-ค่าไฟ */}
          <div className="card" style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>
              <h3 style={{ fontSize: "16px" }}>⚡ วิเคราะห์กำไรค่าน้ำ-ค่าไฟ (Utility Profit Analysis)</h3>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* ค่าไฟฟ้า */}
              <div style={{ backgroundColor: "var(--bg-main)", padding: "16px", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", color: "var(--warning)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚡</span> ค่าไฟฟ้า
                </h4>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
                  <span>ยอดใช้งานรวม (หน่วย)</span>
                  <span style={{ fontWeight: 600 }}>{stats.elecUnits} หน่วย</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
                  <span>รายรับที่เก็บผู้เช่า (เฉพาะบิลที่ชำระแล้ว)</span>
                  <span style={{ fontWeight: 600, color: "var(--success)" }}>+{stats.incomeElec.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "12px", alignItems: "center" }}>
                  <span>รายจ่าย (บิลการไฟฟ้าที่บันทึก)</span>
                  <span style={{ fontWeight: 600, color: "var(--danger)" }}>-{officialElecAmount.toLocaleString()} ฿</span>
                </div>
                
                <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 700 }}>
                  <span>กำไรสุทธิค่าไฟเบื้องต้น</span>
                  <span style={{ color: utilProfitElec >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {utilProfitElec > 0 ? "+" : ""}{utilProfitElec.toLocaleString()} ฿
                  </span>
                </div>
                
                <div className="no-print" style={{ marginTop: "16px" }}>
                  <button onClick={() => {
                    setExpenseForm({ date: toDate, title: "ค่าไฟฟ้า (บิลทางการ)", amount: 0, note: "", category: "official_elec" });
                    setShowExpenseModal(true);
                  }} className="btn btn-outline btn-sm" style={{ width: "100%", justifyContent: "center" }}>
                    + กรอกบิลการไฟฟ้าจริง
                  </button>
                </div>
              </div>

              {/* ค่าน้ำประปา */}
              <div style={{ backgroundColor: "var(--bg-main)", padding: "16px", borderRadius: "8px" }}>
                <h4 style={{ fontSize: "14px", color: "var(--info)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>💧</span> ค่าน้ำประปา
                </h4>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
                  <span>ยอดใช้งานรวม (หน่วย)</span>
                  <span style={{ fontWeight: 600 }}>{stats.waterUnits} หน่วย</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
                  <span>รายรับที่เก็บผู้เช่า (เฉพาะบิลที่ชำระแล้ว)</span>
                  <span style={{ fontWeight: 600, color: "var(--success)" }}>+{stats.incomeWater.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "12px", alignItems: "center" }}>
                  <span>รายจ่าย (บิลประปาที่บันทึก)</span>
                  <span style={{ fontWeight: 600, color: "var(--danger)" }}>-{officialWaterAmount.toLocaleString()} ฿</span>
                </div>
                
                <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: "12px", display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 700 }}>
                  <span>กำไรสุทธิค่าน้ำเบื้องต้น</span>
                  <span style={{ color: utilProfitWater >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {utilProfitWater > 0 ? "+" : ""}{utilProfitWater.toLocaleString()} ฿
                  </span>
                </div>
                
                <div className="no-print" style={{ marginTop: "16px" }}>
                  <button onClick={() => {
                    setExpenseForm({ date: toDate, title: "ค่าน้ำประปา (บิลทางการ)", amount: 0, note: "", category: "official_water" });
                    setShowExpenseModal(true);
                  }} className="btn btn-outline btn-sm" style={{ width: "100%", justifyContent: "center" }}>
                    + กรอกบิลการประปาจริง
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
            {/* รายรับ Section */}
            <div className="card" style={{ flex: 1 }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>
                💰 สรุปรายรับ (จากบิล)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>ค่าเช่าห้องพัก</span>
                  <span style={{ fontWeight: 500 }}>{stats.incomeRoom.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>ค่าไฟฟ้ารวม</span>
                  <span style={{ fontWeight: 500 }}>{stats.incomeElec.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>ค่าน้ำประปารวม</span>
                  <span style={{ fontWeight: 500 }}>{stats.incomeWater.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>ค่าส่วนกลางรวม</span>
                  <span style={{ fontWeight: 500 }}>{stats.incomeCommon.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>ค่าอื่นๆ / บิลพิเศษ</span>
                  <span style={{ fontWeight: 500 }}>{stats.incomeOther.toLocaleString()} ฿</span>
                </div>
                <div style={{ borderTop: "1px dashed var(--border-color)", margin: "8px 0" }}></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                  <span>ยอดบิลรวมทั้งหมดที่ออก</span>
                  <span style={{ fontWeight: 600 }}>{stats.totalBilled.toLocaleString()} ฿</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--success)" }}>
                  <span>ยอดที่ลูกค้าชำระเงินแล้ว</span>
                  <span style={{ fontWeight: 700, fontSize: "16px" }}>{stats.totalCollected.toLocaleString()} ฿</span>
                </div>
              </div>
            </div>

            {/* รายจ่าย Section */}
            <div className="card" style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>
                <h3 style={{ fontSize: "16px" }}>💸 รายจ่าย (Expenses)</h3>
                <button onClick={() => {
                  setExpenseForm({ date: new Date().toISOString().split('T')[0], title: "", amount: 0, note: "", category: "general" });
                  setShowExpenseModal(true);
                }} className="btn btn-outline no-print" style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
                  + เพิ่มรายจ่าย
                </button>
              </div>

              {expenses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
                  ยังไม่มีรายการรายจ่ายในช่วงเวลานี้
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border-light)" }}>
                      <th style={{ padding: "8px", width: "20%" }}>วันที่</th>
                      <th style={{ padding: "8px", width: "40%" }}>รายการ</th>
                      <th style={{ padding: "8px", textAlign: "right", width: "30%" }}>จำนวนเงิน</th>
                      <th className="no-print" style={{ padding: "8px", width: "10%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((ex) => (
                      <tr key={ex.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "8px" }}>{new Date(ex.expense_date).toLocaleDateString('th-TH')}</td>
                        <td style={{ padding: "8px" }}>
                          {ex.title} 
                          {ex.category === 'official_elec' && <span style={{ marginLeft: "4px", fontSize: "12px" }}>⚡</span>}
                          {ex.category === 'official_water' && <span style={{ marginLeft: "4px", fontSize: "12px" }}>💧</span>}
                          <br/><span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{ex.note}</span>
                        </td>
                        <td style={{ padding: "8px", textAlign: "right", color: "var(--danger)", fontWeight: 500 }}>
                          - {Number(ex.amount).toLocaleString()}
                        </td>
                        <td className="no-print" style={{ padding: "8px", textAlign: "right" }}>
                          <button onClick={() => deleteExpense(ex.id)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "16px" }}>×</button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2} style={{ padding: "12px 8px", textAlign: "right", fontWeight: 600 }}>รวมรายจ่ายทั้งสิ้น</td>
                      <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>- {totalExpenses.toLocaleString()} ฿</td>
                      <td className="no-print"></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* รายละเอียดแต่ละบิล */}
          <div className="card" style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "16px", marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid var(--border-light)" }}>
              📋 รายละเอียดบิลรายห้อง
            </h3>
            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
                ไม่มีบิลในช่วงเวลานี้
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-main)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                      <th style={{ padding: "10px" }}>วันที่</th>
                      <th style={{ padding: "10px" }}>เลขที่บิล</th>
                      <th style={{ padding: "10px" }}>ห้อง</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ค่าเช่า</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ค่าไฟ</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ค่าน้ำ</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ค่าส่วนกลาง</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ค่าอื่นๆ</th>
                      <th style={{ padding: "10px", textAlign: "right" }}>ยอดรวม</th>
                      <th style={{ padding: "10px", textAlign: "center" }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "10px" }}>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('th-TH') : '-'}</td>
                        <td style={{ padding: "10px", fontWeight: 500 }}>{inv.invoice_no || '-'}</td>
                        <td style={{ padding: "10px", fontWeight: 600 }}>{inv.room_id}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{Number(inv.room_price || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{Number(inv.elec_total || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{Number(inv.water_total || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{Number(inv.common_fee_total || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>{Number(inv.other_total || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 600, color: "var(--primary)" }}>{Number(inv.grand_total || 0).toLocaleString()}</td>
                        <td style={{ padding: "10px", textAlign: "center" }}>
                          {inv.is_paid ? (
                            <span style={{ color: "var(--success)" }}>✅ ชำระแล้ว</span>
                          ) : (
                            <span style={{ color: "var(--warning)" }}>⏳ รอชำระ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 1000, padding: "40px 0" }}>
          <div className="card" style={{ width: "400px", padding: "24px", margin: "auto" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>
              {expenseForm.category === 'official_elec' ? '⚡ กรอกบิลค่าไฟฟ้า (จากทางการ)' : 
               expenseForm.category === 'official_water' ? '💧 กรอกบิลค่าน้ำประปา (จากทางการ)' : 
               'เพิ่มรายจ่ายใหม่'}
            </h2>
            <form onSubmit={handleAddExpense} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>วันที่</label>
                <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ชื่อรายการ</label>
                <input type="text" required placeholder="เช่น ค่าบำรุงรักษามิเตอร์, ค่าไฟหอพัก" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>จำนวนเงิน (บาท)</label>
                <input type="number" required min="0" value={expenseForm.amount || ''} onChange={e => setExpenseForm({...expenseForm, amount: Number(e.target.value)})} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>หมายเหตุ (ตัวเลือก)</label>
                <textarea rows={2} value={expenseForm.note} onChange={e => setExpenseForm({...expenseForm, note: e.target.value})} className="input-field"></textarea>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowExpenseModal(false)} className="btn btn-outline">ยกเลิก</button>
                <button type="submit" disabled={savingExpense} className="btn btn-primary" style={{ backgroundColor: "var(--danger)" }}>
                  {savingExpense ? "กำลังบันทึก..." : "บันทึกรายจ่าย"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Save Report Modal */}
      {showSaveReportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 1000, padding: "40px 0" }}>
          <div className="card" style={{ width: "400px", padding: "24px", margin: "auto" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>💾 บันทึกรายงาน</h2>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              บันทึกรายงานนี้เก็บไว้ในประวัติ เพื่อให้สามารถเปิดดู พิมพ์ และลบย้อนหลังได้อย่างรวดเร็ว
            </p>
            <form onSubmit={handleSaveReport} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px", display: "block" }}>ชื่อรายงาน</label>
                <input 
                  type="text" 
                  required 
                  placeholder="เช่น รายงานประจำเดือน พฤษภาคม 2569" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)} 
                  className="input-field" 
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowSaveReportModal(false)} className="btn btn-outline">ยกเลิก</button>
                <button type="submit" disabled={savingReport} className="btn btn-primary">
                  {savingReport ? "กำลังบันทึก..." : "ยืนยันการบันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .page-title, .grid-cards, .card, .card *, .page-title * { visibility: visible; }
          .no-print { display: none !important; }
          .card { border: none !important; box-shadow: none !important; margin-bottom: 20px !important; break-inside: avoid; }
          body { padding: 0; background: white; }
          .main-content { padding: 0 !important; margin: 0 !important; }
          /* Reset positioning to allow natural flow across pages */
          .page-title { visibility: visible; margin-bottom: 16px !important; }
          .grid-cards { visibility: visible; margin-bottom: 24px !important; }
          .card { position: static !important; width: 100% !important; margin-top: 0 !important; }
        }
      `}</style>
    </div>
  );
}
