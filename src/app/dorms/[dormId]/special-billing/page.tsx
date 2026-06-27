"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  note: string;
}

export default function SpecialBilling() {
  const params = useParams();
  const dormId = params.dormId as string;

  const [rooms, setRooms] = useState<any[]>([]);
  const [dorm, setDorm] = useState<any>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  
  // Custom Invoice State
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [issueDate, setIssueDate] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setIssueDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    if (!dormId) return;
    fetchData();
  }, [dormId]);

  const fetchData = async () => {
    const { data: dbDorm } = await supabase.from('dormitories').select('*').eq('id', dormId).single();
    if (dbDorm) setDorm(dbDorm);

    const { data: dbRooms } = await supabase.from('rooms').select('*').eq('dorm_id', dormId).order('id', { ascending: true });
    if (dbRooms) setRooms(dbRooms);
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: "", qty: 1, price: 0, note: "" }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveAndPrint = async () => {
    if (!selectedRoomId) return;
    try {
      const d = new Date(issueDate || new Date());
      const billingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const finalInvoiceNo = invoiceNo || `SP-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}-${new Date().getTime().toString().slice(-4)}`;
      const total = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

      const { error } = await supabase.from('invoices').insert({
        room_id: selectedRoomId,
        billing_month: billingMonth,
        issue_date: issueDate || new Date().toISOString().split('T')[0],
        invoice_no: finalInvoiceNo,
        is_special_bill: true,
        custom_items: JSON.stringify(items),
        grand_total: total,
        other_total: total,
        is_paid: false,
        room_price: 0,
        elec_total: 0,
        water_total: 0,
        common_fee_total: 0
      });
      if (error) throw error;
      
      // Update UI state just in case it's used for printing
      setInvoiceNo(finalInvoiceNo);
      
      setTimeout(() => {
        window.print();
      }, 500);
      
      alert("บันทึกและพร้อมพิมพ์บิลเรียบร้อยแล้ว");
    } catch (e: any) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + e.message);
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Compute total
  const grandTotal = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
  let rowCount = 1;

  return (
    <div>
      {/* UI Controls (Not printed) */}
      <div className="no-print" style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: "16px" }}>ออกบิลพิเศษ (Special Billing)</h1>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>เลือกห้อง</div>
                <select 
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit", minWidth: "200px" }}
                >
                  <option value="">-- เลือกห้อง --</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>{r.id} ({r.tenant_name || 'ไม่มีชื่อผู้เช่า'})</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>วันที่ออกบิล</div>
                <input 
                  type="date" 
                  value={issueDate} 
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>เลขที่บิล (เว้นว่างไว้เพื่อสร้างอัตโนมัติ)</div>
                <input 
                  type="text" 
                  value={invoiceNo} 
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="เช่น SP-001"
                  style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </div>
          <div>
            <button 
              className="btn-primary" 
              onClick={handleSaveAndPrint} 
              disabled={!selectedRoom || items.length === 0}
              style={{ backgroundColor: "#000", color: "white", padding: "10px 16px", borderRadius: "var(--radius-sm)", fontWeight: 500, opacity: (!selectedRoom || items.length === 0) ? 0.5 : 1 }}
            >
              💾 บันทึกและพิมพ์บิล
            </button>
          </div>
        </div>

        {selectedRoom && (
          <div className="card" style={{ marginTop: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px" }}>รายการบิล (Items)</h3>
              <button onClick={addItem} style={{ backgroundColor: "var(--primary)", color: "white", padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", fontSize: "13px" }}>
                + เพิ่มรายการ
              </button>
            </div>
            
            {items.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "20px" }}>ยังไม่มีรายการ กรุณากดปุ่ม + เพิ่มรายการ</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {items.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>รายการ {idx + 1}</div>
                      <input type="text" value={item.description} onChange={(e) => updateItem(item.id, 'description', e.target.value)} placeholder="เช่น ค่าซ่อมก๊อกน้ำ" className="input-field" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>จำนวน</div>
                      <input type="number" min="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value))} className="input-field" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>ราคา/หน่วย</div>
                      <input type="number" min="0" value={item.price} onChange={(e) => updateItem(item.id, 'price', parseInt(e.target.value))} className="input-field" />
                    </div>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>หมายเหตุ</div>
                      <input type="text" value={item.note} onChange={(e) => updateItem(item.id, 'note', e.target.value)} placeholder="ไม่บังคับ" className="input-field" />
                    </div>
                    <div style={{ paddingBottom: "10px" }}>
                      <button onClick={() => removeItem(item.id)} style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>✕ ลบ</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Printable Invoice Area */}
      {selectedRoom && dorm && items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ 
            width: "210mm", 
            minHeight: "297mm", 
            backgroundColor: "#fff", 
            padding: "40px", 
            boxShadow: "0 0 10px rgba(0,0,0,0.1)",
            color: "#000",
            fontFamily: "'Prompt', sans-serif"
          }} className="print-area">
            
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>ใบแจ้งหนี้พิเศษ (Special Invoice)</h2>
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
                <span>วันที่ออกบิล : {issueDate ? new Date(issueDate).toLocaleDateString('th-TH') : new Date().toLocaleDateString('th-TH')}</span>
                <span>เลขที่บิล: {invoiceNo || `SP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${new Date().getTime().toString().slice(-4)}`}</span>
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
                {items.map(item => (
                  <tr key={item.id}>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{rowCount++}</td>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>{item.description || "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{item.qty}</td>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>{item.price > 0 ? item.price.toLocaleString() : "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "center", fontSize: "11px" }}>{item.note}</td>
                    <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right" }}>{(item.qty * item.price) > 0 ? (item.qty * item.price).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>ยอดรวมทั้งสิ้น (Grand Total - THB)</td>
                  <td style={{ border: "1px solid #000", padding: "10px", textAlign: "right", fontWeight: "bold" }}>{grandTotal > 0 ? grandTotal.toLocaleString() : "-"}</td>
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
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; box-shadow: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
