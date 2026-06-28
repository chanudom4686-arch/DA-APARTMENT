export async function sendLineNotification(userId: string, message: string) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN");
    return false;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("LINE API Error:", errorData);
      return false;
    }

    console.log("ส่งแจ้งเตือน LINE สำเร็จ:", message);
    return true;
  } catch (error) {
    console.error("Failed to send LINE message:", error);
    return false;
  }
}
