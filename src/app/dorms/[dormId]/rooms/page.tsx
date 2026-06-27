"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { useParams } from "next/navigation";

export default function Rooms() {
  const params = useParams();
  const dormId = params.dormId as string;

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState("");
  const [deleteInvoices, setDeleteInvoices] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalRoomId, setOriginalRoomId] = useState("");
  const [newRoom, setNewRoom] = useState({
    id: "",
    room_type_category: "monthly",
    price: "",
    elec_meter_type: 1,
    water_meter_type: "min",
    water_min_price: "",
    water_flat_price: "",
    common_fee: "",
    billing_cycle_date: 5,
    status: "vacant",
    tenant_name: "",
    tenant_address: "",
    tenant_phone: "",
    details: ""
  });

  useEffect(() => {
    if (dormId) {
      fetchData();
    }
  }, [dormId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('dorm_id', dormId)
        .order('id', { ascending: true });
        
      if (error) throw error;
      setRooms(data || []);
      setErrorMsg("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("⚠️ ตรวจพบข้อผิดพลาดในการโหลดข้อมูลห้องพัก");
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setNewRoom({
      id: "", room_type_category: "monthly", price: "",
      elec_meter_type: 1, water_meter_type: "min", water_min_price: "", water_flat_price: "",
      common_fee: "", billing_cycle_date: 5, status: "vacant", tenant_name: "", tenant_address: "", tenant_phone: "", details: ""
    });
    setShowModal(true);
  };

  const openEditModal = (room: any) => {
    setIsEditing(true);
    setOriginalRoomId(room.id);
    setNewRoom({
      id: room.id,
      room_type_category: room.room_type_category || "monthly",
      price: room.price || "",
      elec_meter_type: room.elec_meter_type || 1,
      water_meter_type: room.water_meter_type || "min",
      water_min_price: room.water_min_price || "",
      water_flat_price: room.water_flat_price || "",
      common_fee: room.common_fee || "",
      billing_cycle_date: room.billing_cycle_date || 5,
      status: room.status || "vacant",
      tenant_name: room.tenant_name || "",
      tenant_address: room.tenant_address || "",
      tenant_phone: room.tenant_phone || "",
      details: room.details || ""
    });
    setShowModal(true);
  };

  const confirmDeleteClick = (roomId: string) => {
    setDeletingRoomId(roomId);
    setDeleteInvoices(false);
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    setSaving(true);
    try {
      if (deleteInvoices) {
        // ลบบิลทั้งหมดของห้องนี้ก่อน
        const { error: invError } = await supabase.from('invoices').delete().eq('room_id', deletingRoomId);
        if (invError) throw invError;
      }

      // ลบห้องพัก
      const { error } = await supabase.from('rooms').delete().eq('id', deletingRoomId).eq('dorm_id', dormId);
      
      if (error) {
        if (error.code === '23503') {
          // Foreign Key Violation
          alert(`ไม่สามารถลบห้องพักได้เนื่องจากมี "ประวัติบิล" ค้างอยู่ในระบบ และคุณเลือกที่จะไม่ลบบิลทิ้ง\n\nระบบฐานข้อมูล (Database) มีการล็อคไว้ไม่ให้ลบห้องที่มีบิลผูกอยู่ครับ\n\nทางแก้:\n1. เลือก "ลบประวัติบิลด้วย" ตอนลบห้อง\n2. หรือไปรันคำสั่ง SQL เพื่อปลดล็อคการเชื่อมโยงข้อมูล (ดูคำแนะนำจาก AI)`);
        } else {
          throw error;
        }
      } else {
        setShowDeleteModal(false);
        fetchData();
      }
    } catch (err: any) {
      alert("ไม่สามารถลบได้: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.id) {
      alert("กรุณากรอกเลขห้อง");
      return;
    }

    setSaving(true);
    try {
      const roomData = {
        id: newRoom.id,
        dorm_id: dormId,
        room_type_category: newRoom.room_type_category,
        price: newRoom.room_type_category === 'special' ? null : Number(newRoom.price) || 0,
        elec_meter_type: Number(newRoom.elec_meter_type),
        water_meter_type: newRoom.water_meter_type,
        water_min_price: Number(newRoom.water_min_price) || 0,
        water_flat_price: Number(newRoom.water_flat_price) || 0,
        common_fee: Number(newRoom.common_fee) || 0,
        billing_cycle_date: Number(newRoom.billing_cycle_date) || 1,
        status: newRoom.status,
        tenant_name: newRoom.tenant_name || null,
        tenant_address: newRoom.tenant_address || null,
        tenant_phone: newRoom.tenant_phone || null,
        details: newRoom.details || null,
        room_type: newRoom.room_type_category === 'monthly' ? "รายเดือน" : newRoom.room_type_category === 'daily' ? "รายวัน" : "พิเศษ"
      };

      if (isEditing) {
        // แก้ไขห้องเดิม
        // ถ้าผู้ใช้เปลี่ยนเลขห้อง ต้องระวังเรื่อง Foreign Key ของ invoices 
        // ปกติเราควรให้ 'id' เป็น uuid แต่ตารางนี้ id เป็น TEXT (เลขห้อง)
        // ถ้าเลขห้องเปลี่ยน เราอัปเดต id ตรงๆ (on update cascade ต้องเปิดไว้ที่ DB)
        const { error } = await supabase.from('rooms').update(roomData).eq('id', originalRoomId).eq('dorm_id', dormId);
        if (error) throw error;
      } else {
        // เพิ่มห้องใหม่
        const { error } = await supabase.from('rooms').insert([roomData]);
        if (error) {
          if (error.code === '23505') alert(`ไม่สามารถเพิ่มได้: มีห้องเลขที่ ${newRoom.id} อยู่แล้ว`);
          else throw error;
          return;
        }
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>จัดการห้องพัก (Rooms Management)</h1>
        <button 
          onClick={openAddModal}
          style={{ backgroundColor: "var(--primary)", color: "white", padding: "10px 16px", borderRadius: "var(--radius-sm)", fontWeight: 500, border: "none", cursor: "pointer" }}
        >
          + เพิ่มห้องพัก
        </button>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning)", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontSize: "14px" }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>รายชื่อห้องพักทั้งหมด</p>
        
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>กำลังโหลดรายชื่อห้องพัก...</div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            ยังไม่มีข้อมูลห้องพักในระบบ กรุณากดปุ่ม "+ เพิ่มห้องพัก" มุมขวาบน
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left", minWidth: "800px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", color: "var(--text-secondary)" }}>
                  <th style={{ padding: "12px 8px" }}>เลขห้อง</th>
                  <th style={{ padding: "12px 8px" }}>ประเภท</th>
                  <th style={{ padding: "12px 8px" }}>รอบบิล</th>
                  <th style={{ padding: "12px 8px" }}>สถานะ</th>
                  <th style={{ padding: "12px 8px" }}>ราคา/หน่วย</th>
                  <th style={{ padding: "12px 8px" }}>ผู้เช่า</th>
                  <th style={{ padding: "12px 8px" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room: any) => (
                  <tr key={room.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ padding: "12px 8px", fontWeight: 500 }}>{room.id}</td>
                    <td style={{ padding: "12px 8px" }}>
                      {room.room_type_category === 'monthly' ? 'รายเดือน' : room.room_type_category === 'daily' ? 'รายวัน' : 'พิเศษ'}
                    </td>
                    <td style={{ padding: "12px 8px" }}>วันที่ {room.billing_cycle_date || 1}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <span className={`badge ${room.status === 'vacant' ? 'badge-success' : 'badge-primary'}`}>
                        {room.status === 'vacant' ? 'ว่าง' : 'มีผู้เช่า'}
                      </span>
                    </td>
                    <td style={{ padding: "12px 8px" }}>
                      {room.room_type_category === 'special' ? 'แอดมินกำหนด' : Number(room.price).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 8px", color: room.tenant_name ? "inherit" : "var(--text-muted)" }}>{room.tenant_name || "-"}</td>
                    <td style={{ padding: "12px 8px" }}>
                      <button onClick={() => openEditModal(room)} style={{ background: "none", border: "none", cursor: "pointer", marginRight: "8px" }}>✏️</button>
                      <button onClick={() => confirmDeleteClick(room.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "flex-start", zIndex: 1000, overflowY: "auto", padding: "40px 0" }}>
          <div className="card" style={{ width: "600px", padding: "24px", margin: "auto" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>{isEditing ? "แก้ไขข้อมูลห้องพัก" : "เพิ่มห้องพักใหม่"}</h2>
            
            <form onSubmit={handleSaveRoom} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* ส่วนที่ 1: ข้อมูลพื้นฐาน */}
              <div>
                <h3 style={{ fontSize: "15px", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", color: "var(--primary)" }}>1. ข้อมูลพื้นฐาน</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>เลขห้อง <span style={{ color: "red" }}>*</span></label>
                    <input type="text" value={newRoom.id} onChange={e => setNewRoom({...newRoom, id: e.target.value})} className="input-field" placeholder="เช่น A101" required disabled={isEditing} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>รอบออกบิล (วันที่ของเดือน)</label>
                    <input type="number" min="1" max="31" value={newRoom.billing_cycle_date} onChange={e => setNewRoom({...newRoom, billing_cycle_date: parseInt(e.target.value)})} className="input-field" placeholder="เช่น วันที่ 5" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ประเภทการเช่า</label>
                    <select value={newRoom.room_type_category} onChange={e => setNewRoom({...newRoom, room_type_category: e.target.value})} className="input-field">
                      <option value="monthly">รายเดือน</option>
                      <option value="daily">รายวัน</option>
                      <option value="special">เช่าแบบพิเศษ (ราคาไม่ตายตัว)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      {newRoom.room_type_category === 'monthly' ? 'ค่าเช่า (บาท/เดือน)' : newRoom.room_type_category === 'daily' ? 'ค่าเช่า (บาท/วัน)' : 'ค่าเช่า (แอดมินกรอกเอง)'}
                    </label>
                    <input type="number" value={newRoom.price} onChange={e => setNewRoom({...newRoom, price: e.target.value})} className="input-field" placeholder="ระบุจำนวนเงิน" disabled={newRoom.room_type_category === 'special'} required={newRoom.room_type_category !== 'special'} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>สถานะห้อง</label>
                    <select value={newRoom.status} onChange={e => setNewRoom({...newRoom, status: e.target.value})} className="input-field">
                      <option value="vacant">ว่าง (Vacant)</option>
                      <option value="occupied">มีผู้เช่า (Occupied)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ส่วนที่ 2: ระบบมิเตอร์น้ำไฟ */}
              <div>
                <h3 style={{ fontSize: "15px", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", color: "var(--primary)" }}>2. ตั้งค่ามิเตอร์และการคิดเงิน</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>มิเตอร์ไฟฟ้า</label>
                    <select value={newRoom.elec_meter_type} onChange={e => setNewRoom({...newRoom, elec_meter_type: parseInt(e.target.value)})} className="input-field">
                      <option value={1}>1 ตัว (มิเตอร์ A)</option>
                      <option value={2}>2 ตัว (มิเตอร์ A และ B แยกลงบิล)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ค่าส่วนกลาง (บาท/เดือน)</label>
                    <input type="number" value={newRoom.common_fee} onChange={e => setNewRoom({...newRoom, common_fee: e.target.value})} className="input-field" placeholder="เช่น 200 (ใส่ 0 ถ้าไม่มี)" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>มิเตอร์น้ำ</label>
                    <select value={newRoom.water_meter_type} onChange={e => setNewRoom({...newRoom, water_meter_type: e.target.value})} className="input-field">
                      <option value="min">คิดตามจริง (มีขั้นต่ำ)</option>
                      <option value="flat">เหมาจ่ายรายเดือน</option>
                    </select>
                  </div>
                  <div>
                    {newRoom.water_meter_type === 'min' ? (
                      <>
                        <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ค่าน้ำขั้นต่ำ (บาท/เดือน)</label>
                        <input type="number" value={newRoom.water_min_price} onChange={e => setNewRoom({...newRoom, water_min_price: e.target.value})} className="input-field" placeholder="เช่น 100" />
                      </>
                    ) : (
                      <>
                        <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ค่าน้ำเหมาจ่าย (บาท/เดือน)</label>
                        <input type="number" value={newRoom.water_flat_price} onChange={e => setNewRoom({...newRoom, water_flat_price: e.target.value})} className="input-field" placeholder="เช่น 150" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ส่วนที่ 3: ข้อมูลผู้เช่า */}
              {newRoom.status === 'occupied' && (
                <div>
                  <h3 style={{ fontSize: "15px", borderBottom: "1px solid var(--border-light)", paddingBottom: "8px", marginBottom: "12px", color: "var(--primary)" }}>3. ข้อมูลผู้เช่า</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ชื่อ-สกุล ผู้เช่า</label>
                      <input type="text" value={newRoom.tenant_name} onChange={e => setNewRoom({...newRoom, tenant_name: e.target.value})} className="input-field" />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>เบอร์โทรศัพท์</label>
                      <input type="text" value={newRoom.tenant_phone} onChange={e => setNewRoom({...newRoom, tenant_phone: e.target.value})} className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>ที่อยู่ (ตามบัตรประชาชน)</label>
                    <textarea value={newRoom.tenant_address} onChange={e => setNewRoom({...newRoom, tenant_address: e.target.value})} className="input-field" rows={2} />
                  </div>
                </div>
              )}

              {/* ส่วนที่ 4: อื่นๆ */}
              <div>
                <label style={{ display: "block", fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>รายละเอียดเพิ่มเติม (Note)</label>
                <textarea value={newRoom.details} onChange={e => setNewRoom({...newRoom, details: e.target.value})} className="input-field" rows={2} placeholder="เช่น ทะเบียนรถ, ผู้พักร่วม ฯลฯ" />
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
                  {saving ? "กำลังบันทึก..." : "💾 บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div className="card" style={{ width: "450px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "var(--danger)" }}>⚠️ ยืนยันการลบห้องพัก</h2>
            <p style={{ marginBottom: "16px", color: "var(--text-secondary)", fontSize: "15px" }}>
              คุณกำลังจะลบห้อง <strong>{deletingRoomId}</strong> ออกจากระบบ
            </p>
            
            <div style={{ backgroundColor: "var(--warning-bg)", padding: "16px", borderRadius: "var(--radius-sm)", marginBottom: "20px" }}>
              <p style={{ fontSize: "14px", color: "var(--text-primary)", marginBottom: "8px", fontWeight: 500 }}>
                ตัวเลือกการจัดการประวัติบิล:
              </p>
              <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--text-secondary)" }}>
                <input 
                  type="checkbox" 
                  checked={deleteInvoices} 
                  onChange={(e) => setDeleteInvoices(e.target.checked)} 
                  style={{ marginTop: "4px" }}
                />
                <span>
                  <strong>ลบประวัติบิลทั้งหมดของห้องนี้ด้วย</strong><br/>
                  (หากไม่ลบบิล ระบบอาจปฏิเสธการลบห้องพักเนื่องจากข้อจำกัดของฐานข้อมูลที่ผูกข้อมูลกันไว้)
                </span>
              </label>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-outline"
                disabled={saving}
              >
                ยกเลิก
              </button>
              <button 
                onClick={executeDelete}
                className="btn btn-primary"
                style={{ backgroundColor: "var(--danger)" }}
                disabled={saving}
              >
                {saving ? "กำลังดำเนินการ..." : "ยืนยันการลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
