import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { sendLineBroadcast } from '@/lib/line';

export async function GET(request: Request) {
  try {
    // Vercel Cron Security: Ensure the request comes from Vercel
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch all dorms
    const { data: dorms, error: dormError } = await supabase.from('dormitories').select('*');
    if (dormError) throw dormError;
    if (!dorms || dorms.length === 0) {
      return NextResponse.json({ success: true, message: 'No dorms found' });
    }

    // 2. Fetch all rooms
    const { data: rooms, error: roomError } = await supabase.from('rooms').select('*').eq('status', 'occupied');
    if (roomError) throw roomError;

    // 3. Fetch all unpaid invoices
    const { data: invoices, error: invError } = await supabase.from('invoices').select('*').eq('is_paid', false);
    if (invError) throw invError;

    const today = new Date().getDate();
    let totalUnpaid = 0;
    let totalUpcoming = 0;
    
    let message = `📊 สรุปข้อมูลประจำวัน (ระบบอัตโนมัติ)\n`;

    // Process per dorm
    for (const dorm of dorms) {
      const dormRooms = (rooms || []).filter(r => r.dorm_id === dorm.id);
      if (dormRooms.length === 0) continue;

      const dormInvoices = (invoices || []).filter(inv => dormRooms.some(r => r.id === inv.room_id));
      
      const upcomingRooms = dormRooms.filter(room => {
        const billDate = room.billing_cycle_date;
        if (!billDate) return false;
        let diff = billDate - today;
        if (diff < 0) diff += 30; // Handle next month
        return diff <= 3 && diff >= 0;
      });

      if (dormInvoices.length > 0 || upcomingRooms.length > 0) {
        message += `\n🏢 หอพัก: ${dorm.name}\n`;

        if (dormInvoices.length > 0) {
          totalUnpaid += dormInvoices.length;
          message += `🔴 ค้างชำระ (${dormInvoices.length} ห้อง):\n`;
          dormInvoices.forEach(inv => {
            message += `- ห้อง ${inv.room_id}: ${Number(inv.grand_total).toLocaleString()} บาท\n`;
          });
        }

        if (upcomingRooms.length > 0) {
          totalUpcoming += upcomingRooms.length;
          message += `⚠️ ใกล้ถึงรอบบิล (${upcomingRooms.length} ห้อง):\n`;
          upcomingRooms.forEach(room => {
            message += `- ห้อง ${room.id} (รอบวันที่ ${room.billing_cycle_date})\n`;
          });
        }
      }
    }

    // If nothing to report
    if (totalUnpaid === 0 && totalUpcoming === 0) {
      await sendLineBroadcast("ว่าง ไปเติมเกย์ได้ละ : จดหอให้สุดสวย");
    } else {
      await sendLineBroadcast(message);
    }

    return NextResponse.json({ success: true, message: 'Cron job executed successfully' });
  } catch (error) {
    console.error('Error in daily-summary cron:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
