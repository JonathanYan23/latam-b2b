"use client";

import { useEffect, useRef } from "react";
import { markConversationReadAction } from "@/lib/message-actions";

/** 挂在聊天页：挂载即标记该会话对方消息已读（server action 会 revalidate 导航红点） */
export function ReadMarker({
  wholesalerId,
  retailerId,
}: {
  wholesalerId: string;
  retailerId: string;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    markConversationReadAction(wholesalerId, retailerId);
  }, [wholesalerId, retailerId]);
  return null;
}
