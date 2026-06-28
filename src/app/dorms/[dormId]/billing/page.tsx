"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";
import { calculateInvoice, MeterConfig } from "@/utils/calculate";

export default function BillingHistory() {
  const params = useParams();
  const dormId = params.dormId as string;

  const [billingMonth, setBillingMonth] = useState("");
  const [filterIssueDate, setFilterIssueDate] = useState("");
  const [filterRoomId, setFilterRoomId] = useState("all");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [dorm, setDorm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [viewInvoice, setViewInvoice] = useState<any>(null);
  const [editInvoice, setEditInvoice] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    setBillingMonth(`${yyyy}-${mm}`);
  }, []);

  useEffect(() => {
    if (!dormId) return;
    fetchData();
  }, [billingMonth, filterIssueDate, filterRoomId, dormId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbDorm } = await supabase.from('dormitories').select('*').eq('id', dormId).single();
      if (dbDorm) setDorm(dbDorm);

      const { data: dbRooms } = await supabase.from('rooms').select('*').eq('dorm_id', dormId).order('id', { ascending: true });
      if (dbRooms) setRooms(dbRooms);

      if (dbRooms && dbRooms.length > 0) {
        let roomIdsToFetch = dbRooms.map(r => r.id);
        if (filterRoomId !== "all") {
          roomIdsToFetch = [filterRoomId];
        }

        let query = supabase
          .from('invoices')
          .select('*')
          .in('room_id', roomIdsToFetch)
          .order('issue_date', { ascending: true })
          .order('invoice_no', { ascending: true });
          
        if (billingMonth) query = query.eq('billing_month', billingMonth);
        if (filterIssueDate) query = query.eq('issue_date', filterIssueDate);

        query = query.limit(200);

        const { data: dbInvoices } = await query;
        if (dbInvoices) setInvoices(dbInvoices);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePaidStatus = async (invoiceId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('invoices').update({ is_paid: !currentStatus }).eq('id', invoiceId);
      if (error) throw error;
      setInvoices(invoices.map(inv => inv.id === invoiceId ? { ...inv, is_paid: !currentStatus } : inv));
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะบิล");
    }
  };

  const deleteInvoice = async (invoiceId: string, roomNo: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบบิลของห้อง ${roomNo}?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;
      setInvoices(invoices.filter(inv => inv.id !== invoiceId));
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบบิล");
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvoice || !dorm) return;
    setSaving(true);
    try {
      const room = rooms.find(r => r.id === editInvoice.room_id);
      if (!room) throw new Error("Room not found");

      const config: MeterConfig = {
        elecType: "meter", elecRate: Number(dorm.elec_rate) || 8,
        waterType: "meter_with_min", waterRate: Number(dorm.water_rate) || 20,
        waterMinUnits: 0, waterMinPrice: 0, commonFee: 0
      };

      const calc = calculateInvoice({
        roomId: room.id,
        roomPrice: Number(room.price) || 0,
        prevElec: Number(editInvoice.prev_elec) || 0,
        currentElec: Number(editInvoice.current_elec) || 0,
        prevElecB: Number(editInvoice.prev_elec_b) || 0,
        currentElecB: Number(editInvoice.current_elec_b) || 0,
        elecMeterType: room.elec_meter_type || 1,
        prevWater: Number(editInvoice.prev_water) || 0,
        currentWater: Number(editInvoice.current_water) || 0,
        waterMeterType: room.water_meter_type || 'min',
        waterMinPrice: Number(room.water_min_price) || 0,
        waterFlatPrice: Number(room.water_flat_price) || 0,
        commonFee: Number(room.common_fee) || 0,
        config: config
      });

      if (editInvoice.invoice_no) {
        const { data: duplicateCheck } = await supabase
          .from('invoices')
          .select('id')
          .eq('invoice_no', editInvoice.invoice_no)
          .neq('id', editInvoice.id)
          .limit(1);

        if (duplicateCheck && duplicateCheck.length > 0) {
          throw new Error("เลขที่บิลนี้มีซ้ำอยู่ในระบบแล้ว กรุณาใช้เลขอื่น");
        }
      }

      const updateData = {
        prev_elec: Number(editInvoice.prev_elec) || 0,
        current_elec: Number(editInvoice.current_elec) || 0,
        prev_elec_b: Number(editInvoice.prev_elec_b) || 0,
        current_elec_b: Number(editInvoice.current_elec_b) || 0,
        prev_water: Number(editInvoice.prev_water) || 0,
        current_water: Number(editInvoice.current_water) || 0,
        issue_date: editInvoice.issue_date || null,
        invoice_no: editInvoice.invoice_no || null,
        grand_total: calc.grandTotal + Number(editInvoice.other_total || 0),
        room_price: room.room_type_category === 'special' ? 0 : (Number(room.price) || 0),
        elec_total: calc.elecTotalA + (calc.elecTotalB || 0),
        water_total: calc.waterTotal,
        common_fee_total: calc.commonFee
      };

      const { error } = await supabase.from('invoices').update(updateData).eq('id', editInvoice.id);
      if (error) throw error;
      
      setEditInvoice(null);
      fetchData();
    } catch (err: any) {
      alert("บันทึกไม่สำเร็จ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getInvoicePrintData = (inv: any) => {
    const room = rooms.find(r => r.id === inv.room_id);
    if (!room || !dorm) return null;
    const config: MeterConfig = {
      elecType: "meter", elecRate: Number(dorm.elec_rate) || 8,
      waterType: "meter_with_min", waterRate: Number(dorm.water_rate) || 20,
      waterMinUnits: 0, waterMinPrice: 0, commonFee: 0
    };
    return calculateInvoice({
      roomId: room.id,
      roomPrice: Number(room.price) || 0,
      prevElec: Number(inv.prev_elec) || 0,
      currentElec: Number(inv.current_elec) || 0,
      prevElecB: Number(inv.prev_elec_b) || 0,
      currentElecB: Number(inv.current_elec_b) || 0,
      elecMeterType: room.elec_meter_type || 1,
      prevWater: Number(inv.prev_water) || 0,
      currentWater: Number(inv.current_water) || 0,
      waterMeterType: room.water_meter_type || 'min',
      waterMinPrice: Number(room.water_min_price) || 0,
      waterFlatPrice: Number(room.water_flat_price) || 0,
      commonFee: Number(room.common_fee) || 0,
      config
    });
  };

  return (
    <div>
      <div className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: "16px" }}>ประวัติบิลและการจัดการ (Billing History)</h1>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>รอบบิล (เดือน/ปี)</div>
                <input 
                  type="month" 
                  value={billingMonth} 
                  onChange={(e) => setBillingMonth(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit", width: "150px" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่ออกบิล</div>
                <input 
                  type="date" 
                  value={filterIssueDate} 
                  onChange={(e) => setFilterIssueDate(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit", width: "150px" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>ห้องพัก</div>
                <select 
                  value={filterRoomId} 
                  onChange={(e) => setFilterRoomId(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit", width: "150px", backgroundColor: "white" }}
                >
                  <option value="all">-- ทุกห้อง --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>ห้อง {r.id}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>กำลังโหลดข้อมูลบิล...</div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            {invoices.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>ไม่พบบิลในรอบเดือนที่เลือก</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-main)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: "16px" }}>วันที่ออกบิล</th>
                    <th style={{ padding: "16px" }}>เลขที่บิล</th>
                    <th style={{ padding: "16px" }}>ห้องพัก</th>
                    <th style={{ padding: "16px", textAlign: "right" }}>ยอดรวม (บาท)</th>
                    <th style={{ padding: "16px", textAlign: "center" }}>สถานะ</th>
                    <th style={{ padding: "16px", textAlign: "right" }}>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const room = rooms.find(r => r.id === inv.room_id);
                    return (
                      <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "16px" }}>{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString('th-TH') : '-'}</td>
                        <td style={{ padding: "16px" }}>
                          {inv.invoice_no ? (
                            <span className="badge badge-primary" style={{ fontSize: "13px", padding: "6px 12px" }}>{inv.invoice_no}</span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: "16px" }}>
                          <span style={{ fontWeight: 600 }}>{inv.room_id}</span>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{room?.tenant_name || '-'}</div>
                        </td>
                        <td style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "var(--primary)" }}>
                          {Number(inv.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "16px", textAlign: "center" }}>
                          <button 
                            onClick={() => togglePaidStatus(inv.id, inv.is_paid)}
                            style={{ 
                              padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: 500, border: "none", cursor: "pointer",
                              backgroundColor: inv.is_paid ? "var(--success-bg)" : "var(--warning-bg)",
                              color: inv.is_paid ? "var(--success)" : "var(--warning)"
                            }}
                          >
                            {inv.is_paid ? "✅ ชำระแล้ว" : "⏳ รอชำระ"}
                          </button>
                        </td>
                        <td style={{ padding: "16px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button onClick={() => setViewInvoice(inv)} style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--primary)", color: "var(--primary)", background: "white" }}>
                              🖨️ ปริ้น
                            </button>
                            {!inv.is_special_bill && (
                              <button onClick={() => setEditInvoice(inv)} style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "white" }}>
                                ✏️ แก้ไข
                              </button>
                            )}
                            <button onClick={() => deleteInvoice(inv.id, inv.room_id)} style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--danger)", color: "var(--danger)", background: "white" }}>
                              🗑️ ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editInvoice && (
        <div className="no-print" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 1000, overflowY: "auto", padding: "40px 0" }}>
          <div className="card" style={{ width: "500px", padding: "24px", margin: "auto" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>แก้ไขมิเตอร์ห้อง {editInvoice.room_id}</h2>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>วันที่ออกบิล</label>
                  <input type="date" value={editInvoice.issue_date || ""} onChange={e => setEditInvoice({...editInvoice, issue_date: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>เลขที่บิล (Invoice No.)</label>
                  <input type="text" value={editInvoice.invoice_no || ""} onChange={e => setEditInvoice({...editInvoice, invoice_no: e.target.value})} className="input-field" placeholder="เว้นว่างถ้ายังไม่ระบุ" />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ไฟฟ้าครั้งก่อน</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.prev_elec} onChange={e => setEditInvoice({...editInvoice, prev_elec: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ไฟฟ้าครั้งนี้</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.current_elec} onChange={e => setEditInvoice({...editInvoice, current_elec: e.target.value})} className="input-field" />
                </div>
              </div>
              
              {rooms.find(r => r.id === editInvoice.room_id)?.elec_meter_type === 2 && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ไฟฟ้า B ครั้งก่อน</label>
                    <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.prev_elec_b} onChange={e => setEditInvoice({...editInvoice, prev_elec_b: e.target.value})} className="input-field" />
                  </div>
                  <div>
                    <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ไฟฟ้า B ครั้งนี้</label>
                    <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.current_elec_b} onChange={e => setEditInvoice({...editInvoice, current_elec_b: e.target.value})} className="input-field" />
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ประปาครั้งก่อน</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.prev_water} onChange={e => setEditInvoice({...editInvoice, prev_water: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)" }}>ประปาครั้งนี้</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={editInvoice.current_water} onChange={e => setEditInvoice({...editInvoice, current_water: e.target.value})} className="input-field" />
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setEditInvoice(null)} className="btn btn-outline">ยกเลิก</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View/Print Invoice Modal */}
      {viewInvoice && dorm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, overflowY: "auto" }} className="print-modal-overlay">
          <div style={{ width: "210mm", margin: "40px auto", position: "relative" }} className="print-wrapper">
            
            {/* Action Bar (Not printed) */}
            <div className="no-print" style={{ backgroundColor: "white", padding: "16px", borderRadius: "var(--radius-sm)", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "var(--shadow-md)" }}>
              <div style={{ fontWeight: 600 }}>บิลห้อง {viewInvoice.room_id} ({billingMonth})</div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button onClick={() => setViewInvoice(null)} style={{ padding: "8px 16px", border: "1px solid var(--border-color)", background: "white", borderRadius: "var(--radius-sm)", cursor: "pointer" }}>❌ ปิด</button>
                <button onClick={() => window.print()} style={{ padding: "8px 16px", background: "#000", color: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", fontWeight: 500 }}>🖨️ สั่งพิมพ์ (Print)</button>
              </div>
            </div>

            {/* Print Area */}
            {(() => {
              const selectedRoom = rooms.find(r => r.id === viewInvoice.room_id);
              const invoiceData = getInvoicePrintData(viewInvoice);
              if (!selectedRoom || !invoiceData) return <div>Data Error</div>;
              let rowCount = 1;
              return (
                <div style={{ 
                  backgroundColor: "#fff", 
                  padding: "40px", 
                  boxShadow: "0 0 10px rgba(0,0,0,0.1)",
                  color: "#000",
                  fontFamily: "'Prompt', sans-serif"
                }} className="print-area">
                  
                  <div style={{ textAlign: "center", marginBottom: "30px" }}>
                    <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>ใบแจ้งหนี้ / ใบเสร็จรับเงิน</h2>
                    <h1 style={{ fontSize: "28px", fontWeight: "normal" }}>{dorm.name.toUpperCase()}</h1>
                  </div>

                  <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                    <div style={{ display: "flex" }}><div style={{ width: "60px" }}>ลูกค้า</div> : {selectedRoom.tenant_name || "-"}</div>
                    <div style={{ display: "flex" }}><div style={{ width: "60px" }}>ห้อง</div> : {selectedRoom.id}</div>
                    <div style={{ display: "flex" }}><div style={{ width: "60px" }}>ที่อยู่</div> : {selectedRoom.tenant_address || "-"}</div>
                  </div>

                  <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                    <div>เบอร์โทร : {selectedRoom.tenant_phone || "-"}</div>
                    <div style={{ display: "flex", gap: "24px", marginTop: "8px" }}>
                      <span>วันที่ออกบิล : {viewInvoice.issue_date ? new Date(viewInvoice.issue_date).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH')}</span>
                      <span>รอบบิล : {billingMonth}</span>
                      <span>เลขที่บิล: {viewInvoice.invoice_no || `รอการออกบิลในระบบ`}</span>
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", margin: "16px 0" }}></div>

                  <div style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ display: "flex" }}><div style={{ width: "60px" }}>ผู้ออก</div> : {dorm.manager_name || "-"}</div>
                      <div>เบอร์ติดต่อ: {dorm.phone || "-"}</div>
                    </div>
                    <div style={{ display: "flex", marginTop: "4px" }}><div style={{ width: "60px" }}>ที่อยู่หอพัก</div> : {dorm.address || "-"}</div>
                  </div>

                  <div style={{ borderTop: "1px solid #000", margin: "16px 0" }}></div>

                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "14px", marginBottom: "30px" }}>
                    <thead>
                      <tr>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "5%" }}>NO</th>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "40%" }}>รายการ (Description)</th>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "10%" }}>หน่วย (Qty)</th>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "15%" }}>ราคา/หน่วย (Unit Price)</th>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "15%" }}>หมายเหตุ (Note)</th>
                        <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center", width: "15%" }}>รวม (Total)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRoom.room_type_category !== 'special' && (
                        <tr>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>ค่าเช่าห้องพัก (Room Rent)</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>1</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{selectedRoom.price > 0 ? Number(selectedRoom.price).toLocaleString() : "-"}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}></td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{selectedRoom.price > 0 ? Number(selectedRoom.price).toLocaleString() : "-"}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>ค่าไฟฟ้า {selectedRoom.elec_meter_type === 2 ? "มิเตอร์ A" : ""} ({viewInvoice.prev_elec || 0} ➔ {viewInvoice.current_elec || 0})</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{invoiceData.elecUsageA}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{dorm.elec_rate}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}></td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{invoiceData.elecTotalA.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
                      </tr>
                      {selectedRoom.elec_meter_type === 2 && (
                        <tr>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>ค่าไฟฟ้า มิเตอร์ B ({viewInvoice.prev_elec_b || 0} ➔ {viewInvoice.current_elec_b || 0})</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{invoiceData.elecUsageB}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{dorm.elec_rate}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}></td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{invoiceData.elecTotalB.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>ค่าน้ำประปา {selectedRoom.water_meter_type === 'flat' ? "(เหมาจ่าย)" : `(${viewInvoice.prev_water || 0} ➔ ${viewInvoice.current_water || 0})`}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{selectedRoom.water_meter_type === 'flat' ? "-" : invoiceData.waterUsage}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{selectedRoom.water_meter_type === 'flat' ? "-" : dorm.water_rate}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center", fontSize: "11px" }}>{selectedRoom.water_meter_type === 'min' ? `ขั้นต่ำ ${selectedRoom.water_min_price} THB` : ''}</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{invoiceData.waterTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
                      </tr>
                      {invoiceData.commonFee > 0 && (
                        <tr>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>ค่าส่วนกลาง (Common Fee)</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>1</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{invoiceData.commonFee.toFixed(2)}</td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}></td>
                          <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{invoiceData.commonFee.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan={5} style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>ยอดรวมทั้งสิ้น (Grand Total - THB)</td>
                        <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>{invoiceData.grandTotal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ borderTop: "1px solid #000", margin: "16px 0", width: "100%" }}></div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: "20px" }}>
                    <div style={{ fontSize: "13px", lineHeight: "1.6", maxWidth: "60%" }}>
                      {dorm.invoice_note && (
                        <div style={{ marginBottom: "12px", padding: "8px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
                          <strong>หมายเหตุ (Note):</strong><br/>
                          {dorm.invoice_note.split('\n').map((line: string, i: number) => <div key={i}>{line}</div>)}
                        </div>
                      )}
                      <div style={{ marginTop: "12px" }}><strong>ข้อมูลการชำระเงิน (Payment Info):</strong></div>
                      {dorm.bank_acc_name && <div>ชื่อบัญชี : {dorm.bank_acc_name}</div>}
                      {dorm.bank_name && <div>ธนาคาร : {dorm.bank_name}</div>}
                      {dorm.bank_acc_no && <div>เลขบัญชี : {dorm.bank_acc_no}</div>}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      {dorm.promptpay_qr_url ? (
                        <img src={dorm.promptpay_qr_url} alt="QR Code" style={{ width: "140px", height: "140px", objectFit: "contain", border: "1px solid #eee", padding: "4px" }} />
                      ) : (
                        <div style={{ width: "140px", height: "140px", border: "1px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#999" }}>
                          ไม่มี QR Code
                        </div>
                      )}
                      <div style={{ fontSize: "12px", marginTop: "4px" }}>สแกนเพื่อชำระเงิน</div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; box-shadow: none !important; margin: 0; }
          .no-print { display: none !important; }
          .print-modal-overlay { background: none !important; padding: 0; margin: 0; }
          .print-wrapper { margin: 0 !important; width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
