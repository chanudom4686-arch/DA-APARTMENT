"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { calculateInvoice, MeterConfig } from "@/utils/calculate";
import { useParams } from "next/navigation";

export default function MeterRecording() {
  const params = useParams();
  const dormId = params.dormId as string;
  const [billingMonth, setBillingMonth] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [invoices, setInvoices] = useState<any>({});
  const [config, setConfig] = useState<MeterConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize current month and date on load
  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setBillingMonth(`${yyyy}-${mm}`);
    setIssueDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Fetch Data when billingMonth changes
  useEffect(() => {
    if (!billingMonth) return;
    fetchData(billingMonth);
  }, [billingMonth]);

  const fetchData = async (monthStr: string) => {
    setLoading(true);
    setSaveSuccess(false);
    try {
      // 1. Fetch Config from Dormitory
      const { data: dbConfig } = await supabase.from('dormitories').select('*').eq('id', dormId).single();
      const loadedConfig: MeterConfig = dbConfig ? {
        elecType: "meter", elecRate: Number(dbConfig.elec_rate) || 8,
        waterType: "meter_with_min", waterRate: Number(dbConfig.water_rate) || 20,
        waterMinUnits: 0, waterMinPrice: 0, // Not used directly globally anymore, now per-room
        commonFee: 0 // per-room now
      } : {
        // Fallback mock config if no DB record
        elecType: "meter", elecRate: 8,
        waterType: "meter_with_min", waterRate: 20, waterMinUnits: 0, waterMinPrice: 0,
        commonFee: 0
      };
      setConfig(loadedConfig);

      // 2. Fetch Rooms
      const { data: dbRooms, error: roomError } = await supabase.from('rooms').select('*').eq('dorm_id', dormId).order('id', { ascending: true });
      if (roomError) throw roomError;
      
      const loadedRooms = dbRooms || [];
      setRooms(loadedRooms);

      // 3. Fetch Invoices for THIS month (to allow editing)
      const { data: currentInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('billing_month', monthStr);
      
      // 4. Fetch previous Invoices (latest before current month) to get prev meters
      const { data: prevInvoices } = await supabase
        .from('invoices')
        .select('*')
        .in('room_id', loadedRooms.map(r => r.id))
        .lt('billing_month', monthStr)
        .order('billing_month', { ascending: false });

      const invoiceState: any = {};
      
      // Map previous month's current to this month's prev
      const prevMap: any = {};
      if (prevInvoices) {
        for (const inv of prevInvoices) {
          // ถ้าเลขมิเตอร์ในบิลนั้นเป็น 0 หมด (ทั้งที่ห้องใช้มิเตอร์) ให้ข้ามบิลนั้นไปหาบิลที่เก่ากว่าที่มีเลขจริง
          if (inv.current_elec === 0 && inv.prev_elec === 0 && inv.current_water === 0 && inv.prev_water === 0) {
            continue;
          }
          if (!prevMap[inv.room_id]) {
            prevMap[inv.room_id] = { e: inv.current_elec, w: inv.current_water, eb: inv.current_elec_b };
          }
        }
      }

      // Populate form state
      loadedRooms.forEach(room => {
        const curInv = currentInvoices?.find(inv => inv.room_id === room.id && !inv.is_special_bill); // Ignore special bills here
        invoiceState[room.id] = {
          existingInvoice: curInv || null,
          prevElec: curInv?.prev_elec ?? prevMap[room.id]?.e ?? 0,
          currentElec: curInv?.current_elec ?? "",
          prevElecB: curInv?.prev_elec_b ?? prevMap[room.id]?.eb ?? 0,
          currentElecB: curInv?.current_elec_b ?? "",
          prevWater: curInv?.prev_water ?? prevMap[room.id]?.w ?? 0,
          currentWater: curInv?.current_water ?? "",
        };
      });

      setInvoices(invoiceState);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (roomId: string, field: string, value: string) => {
    setInvoices((prev: any) => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);

    // Validate that current meters are not less than previous meters
    let hasError = false;
    for (const room of rooms) {
      const inv = invoices[room.id];
      if (inv.currentElec !== "" && Number(inv.currentElec) < Number(inv.prevElec)) hasError = true;
      if (room.elec_meter_type === 2 && inv.currentElecB !== "" && Number(inv.currentElecB) < Number(inv.prevElecB)) hasError = true;
      if (inv.currentWater !== "" && Number(inv.currentWater) < Number(inv.prevWater)) hasError = true;
    }

    if (hasError) {
      alert("มีข้อผิดพลาด: เลขมิเตอร์ครั้งนี้ ต้องมากกว่าหรือเท่ากับ เลขครั้งก่อน โปรดตรวจสอบช่องที่มีสีแดง");
      setSaving(false);
      return;
    }

    const roomsToProcess = rooms.filter(room => {
      const inv = invoices[room.id];
      if (!inv) return false;
      // ถ้าไม่ได้เลือกทุกห้อง ให้กรองเฉพาะห้องที่เลือก
      if (selectedRoomId !== "all" && room.id !== selectedRoomId) return false;
      // กรองเฉพาะห้องที่มีการกรอกตัวเลขแล้วเท่านั้น
      return (inv.currentElec !== "" || inv.currentWater !== "");
    });

    if (roomsToProcess.length === 0) {
      alert("กรุณากรอกตัวเลขมิเตอร์อย่างน้อย 1 ช่อง (หรือถ้าเป็นแบบเหมาจ่ายกรุณาใส่เลขอะไรก็ได้)");
      setSaving(false);
      return;
    }

    try {
      // Generate invoice numbers
      const year = issueDate ? issueDate.split('-')[0] : new Date().getFullYear().toString();
      const { data: maxInvData } = await supabase
        .from('invoices')
        .select('invoice_no')
        .like('invoice_no', `${year}-%`)
        .order('invoice_no', { ascending: false })
        .limit(1)
        .single();
      
      let nextId = 1;
      if (maxInvData && maxInvData.invoice_no) {
        const parts = maxInvData.invoice_no.split('-');
        if (parts.length === 2) {
          nextId = parseInt(parts[1], 10) + 1;
        }
      }

      const inserts: any[] = [];
      const updates: any[] = [];
      
      roomsToProcess.forEach((room) => {
        const inv = invoices[room.id];
        
        // Calculate grand total automatically
        const calc = calculateInvoice({
          roomId: room.id,
          roomPrice: room.price || 0,
          prevElec: Number(inv.prevElec) || 0,
          currentElec: Number(inv.currentElec) || 0,
          prevElecB: Number(inv.prevElecB) || 0,
          currentElecB: Number(inv.currentElecB) || 0,
          elecMeterType: room.elec_meter_type || 1,
          prevWater: Number(inv.prevWater) || 0,
          currentWater: Number(inv.currentWater) || 0,
          waterMeterType: room.water_meter_type || 'min',
          waterMinPrice: Number(room.water_min_price) || 0,
          waterFlatPrice: Number(room.water_flat_price) || 0,
          commonFee: Number(room.common_fee) || 0,
          config: config
        });

        const baseData = {
          room_id: room.id,
          billing_month: billingMonth,
          issue_date: issueDate || new Date().toISOString().split('T')[0],
          prev_elec: Number(inv.prevElec) || 0,
          current_elec: Number(inv.currentElec) || 0,
          prev_elec_b: Number(inv.prevElecB) || 0,
          current_elec_b: Number(inv.currentElecB) || 0,
          prev_water: Number(inv.prevWater) || 0,
          current_water: Number(inv.currentWater) || 0,
          room_price: room.room_type_category === 'special' ? 0 : (Number(room.price) || 0),
          elec_total: calc.elecTotalA + (calc.elecTotalB || 0),
          water_total: calc.waterTotal,
          common_fee_total: calc.commonFee,
        };

        if (inv.existingInvoice) {
          // Update existing invoice, preserve other_total and is_paid
          const updatedGrandTotal = calc.grandTotal + Number(inv.existingInvoice.other_total || 0);
          updates.push({
            ...inv.existingInvoice, // Preserve existing fields (is_paid, etc.)
            ...baseData,            // Overwrite with new meter calculations
            grand_total: updatedGrandTotal
          });
        } else {
          // Insert new invoice
          const invoice_no = `${year}-${String(nextId).padStart(5, '0')}`;
          nextId++;
          inserts.push({
            ...baseData,
            grand_total: calc.grandTotal,
            invoice_no: invoice_no,
            is_paid: false,
            other_total: 0
          });
        }
      });

      if (inserts.length > 0) {
        const { error } = await supabase.from('invoices').insert(inserts);
        if (error) throw error;
      }
      
      if (updates.length > 0) {
        const { error } = await supabase.from('invoices').upsert(updates, { onConflict: 'id' });
        if (error) throw error;
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก กรุณาดู Console");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "24px" }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: "8px" }}>จดมิเตอร์น้ำ-ไฟ (Meter Recording)</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)", fontSize: "14px", marginTop: "12px" }}>
            <span>เลือกรอบบิล: </span>
            <input 
              type="month" 
              value={billingMonth} 
              onChange={(e) => setBillingMonth(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit" }}
            />
            <span style={{ marginLeft: "12px" }}>วันที่ลงบิล: </span>
            <input 
              type="date" 
              value={issueDate} 
              onChange={(e) => setIssueDate(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-secondary)", fontSize: "14px", marginTop: "12px" }}>
            <span>เลือกห้องพัก: </span>
            <select 
              value={selectedRoomId} 
              onChange={(e) => setSelectedRoomId(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", outline: "none", fontFamily: "inherit" }}
            >
              <option value="all">-- ทุกห้อง --</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>ห้อง {r.id}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {saveSuccess && <span style={{ color: "var(--success)", fontWeight: 500 }}>✅ บันทึกสำเร็จ!</span>}
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={saving || loading}
            style={{ backgroundColor: "var(--success)", padding: "10px 20px", borderRadius: "var(--radius-sm)", color: "white", fontWeight: 500, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "กำลังบันทึก..." : "💾 บันทึกการจดมิเตอร์"}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>กำลังโหลดข้อมูลห้องพัก...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-main)", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "16px", width: "15%" }}>ห้อง / ผู้เช่า</th>
                <th style={{ padding: "16px", width: "20%", borderLeft: "1px solid var(--border-color)" }}>⚡ ไฟฟ้าครั้งก่อน</th>
                <th style={{ padding: "16px", width: "20%" }}>⚡ ไฟฟ้าครั้งนี้</th>
                <th style={{ padding: "16px", width: "20%", borderLeft: "1px solid var(--border-color)" }}>💧 น้ำประปาครั้งก่อน</th>
                <th style={{ padding: "16px", width: "20%" }}>💧 น้ำประปาครั้งนี้</th>
              </tr>
            </thead>
            <tbody>
              {rooms.filter(room => selectedRoomId === "all" || room.id === selectedRoomId).map((room) => {
                const inv = invoices[room.id] || {};
                const elecError = inv.currentElec !== "" && Number(inv.currentElec) < Number(inv.prevElec);
                const waterError = inv.currentWater !== "" && Number(inv.currentWater) < Number(inv.prevWater);

                return (
                  <tr key={room.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "16px" }}>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{room.id}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{room.tenant_name || "-"}</div>
                    </td>
                    <td style={{ padding: "16px", borderLeft: "1px solid var(--border-color)" }}>
                      <div style={{ marginBottom: room.elec_meter_type === 2 ? "12px" : 0 }}>
                        {room.elec_meter_type === 2 && <div style={{fontSize:"12px", color:"var(--text-secondary)", marginBottom:"4px"}}>มิเตอร์ A</div>}
                        <input 
                          type="number" 
                          className="input-field"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          value={inv.prevElec}
                          onChange={(e) => handleInputChange(room.id, "prevElec", e.target.value)}
                          placeholder="เลขครั้งก่อน..."
                          style={{ backgroundColor: "transparent", borderColor: "transparent" }}
                        />
                      </div>
                      {room.elec_meter_type === 2 && (
                        <div>
                          <div style={{fontSize:"12px", color:"var(--text-secondary)", marginBottom:"4px"}}>มิเตอร์ B</div>
                          <input 
                            type="number" 
                            className="input-field"
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            value={inv.prevElecB}
                            onChange={(e) => handleInputChange(room.id, "prevElecB", e.target.value)}
                            placeholder="เลขครั้งก่อน B..."
                            style={{ backgroundColor: "transparent", borderColor: "transparent" }}
                          />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ marginBottom: room.elec_meter_type === 2 ? "12px" : 0 }}>
                        {room.elec_meter_type === 2 && <div style={{fontSize:"12px", color:"transparent", marginBottom:"4px"}}>-</div>}
                        <input 
                          type="number" 
                          className="input-field"
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          value={inv.currentElec}
                          onChange={(e) => handleInputChange(room.id, "currentElec", e.target.value)}
                          placeholder="กรอกตัวเลข..."
                          style={{ borderColor: elecError ? "var(--danger)" : "var(--border-color)" }}
                        />
                        {elecError && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "4px" }}>* ต้องมากกว่าครั้งก่อน</div>}
                      </div>
                      {room.elec_meter_type === 2 && (
                        <div>
                          <div style={{fontSize:"12px", color:"transparent", marginBottom:"4px"}}>-</div>
                          <input 
                            type="number" 
                            className="input-field"
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            value={inv.currentElecB}
                            onChange={(e) => handleInputChange(room.id, "currentElecB", e.target.value)}
                            placeholder="กรอกตัวเลข B..."
                            style={{ borderColor: (inv.currentElecB !== "" && Number(inv.currentElecB) < Number(inv.prevElecB)) ? "var(--danger)" : "var(--border-color)" }}
                          />
                          {(inv.currentElecB !== "" && Number(inv.currentElecB) < Number(inv.prevElecB)) && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "4px" }}>* ต้องมากกว่าครั้งก่อน</div>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "16px", borderLeft: "1px solid var(--border-color)" }}>
                      <input 
                        type="number" 
                        className="input-field"
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        value={inv.prevWater}
                        onChange={(e) => handleInputChange(room.id, "prevWater", e.target.value)}
                        placeholder="เลขครั้งก่อน..."
                        style={{ backgroundColor: "transparent", borderColor: "transparent" }}
                      />
                    </td>
                    <td style={{ padding: "16px" }}>
                      <input 
                        type="number" 
                        className="input-field"
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        value={inv.currentWater}
                        onChange={(e) => handleInputChange(room.id, "currentWater", e.target.value)}
                        placeholder="กรอกตัวเลข..."
                        style={{ borderColor: waterError ? "var(--danger)" : "var(--border-color)" }}
                      />
                      {waterError && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "4px" }}>* ต้องมากกว่าครั้งก่อน</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
