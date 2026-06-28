"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import Link from "next/link";

export default function Dormitories() {
  const [dorms, setDorms] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    manager_name: "",
    phone: "",
    address: "",
    bank_acc_name: "",
    bank_name: "",
    bank_acc_no: "",
    promptpay_qr_url: "",
    invoice_note: "",
    elec_rate: 8,
    water_rate: 20
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbDorms, error: dormError } = await supabase.from('dormitories').select('*').order('created_at', { ascending: true });
      if (dormError) throw dormError;
      setDorms(dbDorms || []);

      // Fetch rooms to calculate alerts
      const { data: dbRooms, error: roomError } = await supabase.from('rooms').select('id, dorm_id, billing_cycle_date, status');
      if (roomError) throw roomError;

      const currentDay = new Date().getDate();
      const newAlerts: any[] = [];

      (dbRooms || []).forEach(room => {
        if (room.status === 'occupied' && room.billing_cycle_date) {
          const diff = room.billing_cycle_date - currentDay;
          // Alert if billing cycle is within the next 3 days, or if it is exactly today
          if (diff >= 0 && diff <= 3) {
            const dorm = dbDorms?.find(d => d.id === room.dorm_id);
            newAlerts.push({
              roomId: room.id,
              dormName: dorm ? dorm.name : 'ไม่ระบุหอพัก',
              daysLeft: diff,
              cycleDate: room.billing_cycle_date
            });
          }
        }
      });

      // Sort alerts by days left
      newAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
      setAlerts(newAlerts);

      // Fetch unpaid invoices
      const { data: dbInvoices, error: invError } = await supabase.from('invoices').select('room_id, grand_total, is_paid').eq('is_paid', false);
      if (invError) throw invError;
      
      const unpaid: any[] = [];
      (dbInvoices || []).forEach(inv => {
        const room = (dbRooms || []).find(r => r.id === inv.room_id);
        const dorm = dbDorms?.find(d => d.id === room?.dorm_id);
        unpaid.push({
           roomId: inv.room_id,
           dormName: dorm ? dorm.name : 'ไม่ระบุหอพัก',
           amount: inv.grand_total
        });
      });
      setUnpaidInvoices(unpaid);

      setErrorMsg("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("⚠️ กรุณารันคำสั่ง SQL เพื่อสร้างตาราง dormitories ก่อนใช้งาน");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, promptpay_qr_url: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (formData.id) {
        // Update
        const { error } = await supabase.from('dormitories').update({
          name: formData.name,
          manager_name: formData.manager_name,
          phone: formData.phone,
          address: formData.address,
          bank_acc_name: formData.bank_acc_name,
          bank_name: formData.bank_name,
          bank_acc_no: formData.bank_acc_no,
          promptpay_qr_url: formData.promptpay_qr_url,
          invoice_note: formData.invoice_note,
          elec_rate: Number(formData.elec_rate),
          water_rate: Number(formData.water_rate)
        }).eq('id', formData.id);
        if (error) throw error;
      } else {
        // Insert
        const { id, ...insertData } = formData;
        const { error } = await supabase.from('dormitories').insert([{
          ...insertData,
          elec_rate: Number(insertData.elec_rate),
          water_rate: Number(insertData.water_rate)
        }]);
        if (error) throw error;
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      id: "", name: "", manager_name: "", phone: "", address: "",
      bank_acc_name: "", bank_name: "", bank_acc_no: "", promptpay_qr_url: "", invoice_note: "",
      elec_rate: 8, water_rate: 20
    });
    setShowModal(true);
  };

  const openEditModal = (dorm: any) => {
    setFormData({
      id: dorm.id,
      name: dorm.name || "",
      manager_name: dorm.manager_name || "",
      phone: dorm.phone || "",
      address: dorm.address || "",
      bank_acc_name: dorm.bank_acc_name || "",
      bank_name: dorm.bank_name || "",
      bank_acc_no: dorm.bank_acc_no || "",
      promptpay_qr_url: dorm.promptpay_qr_url || "",
      invoice_note: dorm.invoice_note || "",
      elec_rate: dorm.elec_rate || 8,
      water_rate: dorm.water_rate || 20
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหอพัก "${name}"?\nการกระทำนี้จะลบห้องพักทั้งหมดในหอพักนี้ด้วย และไม่สามารถย้อนกลับได้`)) {
      setLoading(true);
      try {
        const { error } = await supabase.from('dormitories').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (err: any) {
        console.error(err);
        alert("ไม่สามารถลบได้: " + err.message);
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>จัดการหอพัก (Dormitories)</h1>
        <button 
          onClick={openAddModal}
          style={{ backgroundColor: "var(--primary)", color: "white", padding: "10px 16px", borderRadius: "var(--radius-sm)", fontWeight: 500, border: "none", cursor: "pointer" }}
        >
          + เพิ่มหอพักใหม่
        </button>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning)", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontSize: "14px" }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Left Side: Dorms List */}
        <div>
          {loading ? (
            <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>กำลังโหลดข้อมูลหอพัก...</div>
          ) : dorms.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              ยังไม่มีหอพักในระบบ กรุณากดปุ่ม "+ เพิ่มหอพักใหม่"
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {dorms.map(dorm => (
                <div 
                  key={dorm.id} 
                  className="card" 
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => window.location.href = `/dorms/${dorm.id}/dashboard`}
                >
                  <div>
                    <h2 style={{ fontSize: "18px", color: "var(--text-primary)", marginBottom: "8px" }}>{dorm.name}</h2>
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <p>👤 <strong>ผู้ดูแล:</strong> {dorm.manager_name || "-"}</p>
                      <p>📞 <strong>เบอร์ติดต่อ:</strong> {dorm.phone || "-"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                    <div style={{ padding: "8px 16px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary)", color: "white", fontSize: "14px", fontWeight: 500 }}>
                      ➡️ จัดการหอพักนี้
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(dorm); }}
                        style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "white", cursor: "pointer", fontSize: "12px" }}
                      >
                        ✏️ แก้ไข
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(dorm.id, dorm.name); }}
                        style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--danger)", color: "var(--danger)", background: "white", cursor: "pointer", fontSize: "12px" }}
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Alerts */}
        <div>
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📊</span> สรุปข้อมูลการแจ้งเตือน
            </h3>
            
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "14px", color: "var(--danger)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                🔴 ห้องที่ค้างชำระ ({unpaidInvoices.length} ห้อง)
              </h4>
              {unpaidInvoices.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", fontStyle: "italic" }}>ไม่มีห้องค้างชำระ</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {unpaidInvoices.map((inv, idx) => (
                    <div key={`unpaid-${idx}`} style={{ backgroundColor: "var(--danger-light)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--danger)", fontSize: "14px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>ห้อง {inv.roomId} <span style={{ float: "right", color: "var(--danger)" }}>{Number(inv.amount).toLocaleString()} บาท</span></div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>หอพัก: {inv.dormName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: "14px", color: "var(--warning)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                ⚠️ บิลใกล้ถึงกำหนด ({alerts.length} ห้อง)
              </h4>
              {alerts.length === 0 ? (
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", fontStyle: "italic" }}>ไม่มีห้องที่ใกล้กำหนดออกบิล (ล่วงหน้า 3 วัน)</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {alerts.map((alert, idx) => (
                    <div key={`alert-${idx}`} style={{ backgroundColor: "var(--warning-bg)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--warning)", fontSize: "14px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>ห้อง {alert.roomId}</div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>หอพัก: {alert.dormName}</div>
                      <div style={{ marginTop: "8px", color: alert.daysLeft === 0 ? "var(--danger)" : "var(--warning)", fontWeight: 500 }}>
                        {alert.daysLeft === 0 ? "ถึงรอบออกบิลวันนี้ (วันที่ " + alert.cycleDate + ")" : `อีก ${alert.daysLeft} วัน ถึงรอบออกบิล (วันที่ ${alert.cycleDate})`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border-light)" }}>
               <Link href="/rooms" style={{ display: "block", textAlign: "center", color: "var(--primary)", fontSize: "14px", textDecoration: "none", fontWeight: 500 }}>
                 ไปหน้าจัดการห้องพักทั้งหมด →
               </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 1000, overflowY: "auto", padding: "40px 0" }}>
          <div className="card" style={{ width: "500px", padding: "24px", margin: "auto" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>{formData.id ? "แก้ไขหอพัก" : "เพิ่มหอพักใหม่"}</h2>
            
            <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ชื่อหอพัก <span style={{ color: "red" }}>*</span></label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="input-field" 
                  placeholder="เช่น หอพักสุขใจ สาขา 1"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ผู้ดูแล</label>
                  <input type="text" value={formData.manager_name} onChange={e => setFormData({...formData, manager_name: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>เบอร์ติดต่อ</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ที่อยู่หอพัก</label>
                <textarea 
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="input-field" 
                  rows={2}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>หน่วยค่าไฟฟ้า (บาท/หน่วย)</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={formData.elec_rate} onChange={e => setFormData({...formData, elec_rate: Number(e.target.value)})} className="input-field" step="0.01" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>หน่วยค่าน้ำประปา (บาท/หน่วย)</label>
                  <input type="number" onWheel={(e) => (e.target as HTMLElement).blur()} value={formData.water_rate} onChange={e => setFormData({...formData, water_rate: Number(e.target.value)})} className="input-field" step="0.01" />
                </div>
              </div>

              <h3 style={{ fontSize: "15px", marginTop: "8px", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px" }}>ข้อมูลบัญชีรับเงิน (สำหรับแสดงบนบิล)</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ชื่อบัญชี</label>
                  <input type="text" value={formData.bank_acc_name} onChange={e => setFormData({...formData, bank_acc_name: e.target.value})} className="input-field" />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ชื่อธนาคาร</label>
                  <input type="text" value={formData.bank_name} onChange={e => setFormData({...formData, bank_name: e.target.value})} className="input-field" />
                </div>
              </div>
              
              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>เลขบัญชี</label>
                <input type="text" value={formData.bank_acc_no} onChange={e => setFormData({...formData, bank_acc_no: e.target.value})} className="input-field" />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ไฟล์รูป QR Code</label>
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ fontSize: "14px" }} />
                {formData.promptpay_qr_url && (
                  <div style={{ marginTop: "8px" }}>
                    <img src={formData.promptpay_qr_url} alt="QR Code" style={{ height: "100px", objectFit: "contain", border: "1px solid var(--border-light)" }} />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>หมายเหตุท้ายบิล (เช่น กฎระเบียบข้อบังคับ)</label>
                <textarea 
                  value={formData.invoice_note}
                  onChange={e => setFormData({...formData, invoice_note: e.target.value})}
                  className="input-field" 
                  rows={3}
                  placeholder="เช่น กรุณาชำระเงินภายในวันที่ 5 ของทุกเดือน..."
                />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={{ padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "white", cursor: "pointer" }}
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  style={{ backgroundColor: "var(--primary)", color: "white", padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontWeight: 500, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "กำลังบันทึก..." : "💾 บันทึกหอพัก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
