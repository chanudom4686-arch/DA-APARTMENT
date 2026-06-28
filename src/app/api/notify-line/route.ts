import { NextResponse } from 'next/server';
import { sendLineBroadcast } from '@/lib/line';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const success = await sendLineBroadcast(message);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to send message via LINE' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in notify-line route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
