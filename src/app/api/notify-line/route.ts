import { NextResponse } from 'next/server';
import { sendLineNotification } from '@/lib/line';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const userId = process.env.TEST_LINE_USER_ID;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'TEST_LINE_USER_ID is not configured' }, { status: 500 });
    }

    const success = await sendLineNotification(userId, message);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Failed to send notification' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in notify-line route:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
